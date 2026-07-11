import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { CookieJar } from "tough-cookie";
import { AUTH_FLOW, DEFAULT_UA, DEFAULTS, JUP_BASE } from "./constants.js";
import { NetworkError, TimeoutError, ValidationError, apiErrorFor } from "./errors.js";
import { describe } from "./validate.js";

export interface HttpOptions {
  baseUrl?: string;
  /** Extra default headers merged into every request. */
  headers?: Record<string, string>;
  /** Called once on a 401 to refresh the session; the request then retries. */
  reauth?: () => Promise<void>;
  /** Seed cookies from a `name=value; …` string. */
  cookie?: string;
  /** Persist/restore the cookie jar here (holds the session — keep private). */
  sessionFile?: string;
  /** Per-request timeout in ms (default 30s). */
  timeoutMs?: number;
  /** Retry attempts for 429/5xx/network errors (default 3). */
  maxRetries?: number;
  /** Injectable fetch, for testing. Defaults to global `fetch`. */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  /**
   * Override the retry policy for this request.
   *
   * By default only idempotent methods are retried — see {@link IDEMPOTENT_METHODS}.
   * Set `true` to retry a POST you know is safe to repeat, or `false` to disable
   * retries entirely.
   */
  retry?: boolean;
  /** Internal: set on the retry after re-auth to avoid an infinite loop. */
  _reauthed?: boolean;
  signal?: AbortSignal;
}

/**
 * Methods that may be sent again without changing the outcome.
 *
 * A POST may not: replaying `auth/email/send-code` after a 429 sends the user another
 * email and digs the rate limit deeper, and replaying `verify-code` after a 5xx can
 * spend a one-time code that the server had, in fact, accepted. Repeating a request
 * whose effect we cannot see is not a retry — it is a second request.
 */
export const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * fetch wrapper with:
 *  - a persistent cookie jar (Node's fetch has none),
 *  - browser-like headers + `x-auth-flow` (required to pass Cloudflare + auth),
 *  - a per-request timeout,
 *  - retry with exponential backoff + jitter on 429/5xx/network errors,
 *  - single re-auth + retry on 401.
 *
 * Not usually constructed directly — use {@link JupiterCard}.
 */
export class HttpClient {
  jar: CookieJar;
  private readonly base: string;
  private readonly extraHeaders: Record<string, string>;
  private readonly reauth?: () => Promise<void>;
  private readonly sessionFile?: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: HttpOptions = {}) {
    this.base = opts.baseUrl ?? JUP_BASE;
    this.extraHeaders = opts.headers ?? {};
    this.reauth = opts.reauth;
    this.sessionFile = opts.sessionFile;
    this.timeoutMs = opts.timeoutMs ?? DEFAULTS.timeoutMs;
    this.maxRetries = opts.maxRetries ?? DEFAULTS.maxRetries;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;

    this.jar = new CookieJar();
    if (opts.sessionFile && existsSync(opts.sessionFile)) {
      try {
        this.jar = CookieJar.deserializeSync(readFileSync(opts.sessionFile, "utf8"));
      } catch {
        /* start fresh on a corrupt file */
      }
    }
    if (opts.cookie) this.seedCookies(opts.cookie);
  }

  /** True if an `access_token` cookie is present (a session exists). */
  hasSession(): boolean {
    return this.sessionToken() !== undefined;
  }

  /**
   * The current `access_token` cookie value, if any.
   *
   * Exposed so a refresh can prove the token actually *changed*: presence alone does
   * not mean the refresh worked — the stale cookie is still sitting there.
   */
  sessionToken(): string | undefined {
    return this.jar.getCookiesSync(this.base).find((c) => c.key === "access_token")?.value;
  }

  /** Seed cookies from a `name=value; …` string, then persist. */
  seedCookies(cookieString: string, url = this.base): void {
    for (const pair of cookieString.split(/;\s*/).filter(Boolean)) {
      try {
        this.jar.setCookieSync(pair, url);
      } catch {
        /* ignore malformed pieces */
      }
    }
    this.persist();
  }

  /** Set named cookies (e.g. tokens returned in a login response body). */
  setCookiePairs(pairs: Record<string, string | undefined>, url = this.base): void {
    for (const [name, value] of Object.entries(pairs)) {
      if (value == null) continue;
      try {
        this.jar.setCookieSync(`${name}=${value}`, url);
      } catch {
        /* ignore */
      }
    }
    this.persist();
  }

  /** Persist the cookie jar to `sessionFile` (mode 0600). No-op without one. */
  persist(): void {
    if (!this.sessionFile) return;
    const dir = dirname(this.sessionFile);
    // The file is 0600, but a world-readable directory around it is still a leak of
    // its existence and a place others can drop files; the session is a bearer token.
    if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(this.sessionFile, JSON.stringify(this.jar.serializeSync()), { mode: 0o600 });
  }

  private resolve(path: string): string {
    return path.startsWith("http") ? path : this.base + path;
  }

  private backoff(attempt: number, retryAfterMs?: number): number {
    if (retryAfterMs && retryAfterMs > 0) return Math.min(retryAfterMs, DEFAULTS.retryMaxMs);
    const exp = DEFAULTS.retryBaseMs * 2 ** attempt;
    const jitter = exp * (0.5 + Math.random() * 0.5); // 50–100% of exp
    return Math.min(jitter, DEFAULTS.retryMaxMs);
  }

  /** Whether a failed attempt at this request may be sent again. */
  private mayRetry(method: string, opts: RequestOptions): boolean {
    return opts.retry ?? IDEMPOTENT_METHODS.has(method.toUpperCase());
  }

  async request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const url = new URL(this.resolve(path));
    const retryable = this.mayRetry(method, opts);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }

    const headers: Record<string, string> = {
      accept: "application/json, text/plain, */*",
      "user-agent": DEFAULT_UA,
      "x-auth-flow": AUTH_FLOW,
      referer: this.base + "/",
      origin: this.base,
      "sec-fetch-site": "same-origin",
      "sec-fetch-mode": "cors",
      ...this.extraHeaders,
      ...opts.headers,
    };
    let payload: string | undefined;
    if (opts.body !== undefined) {
      headers["content-type"] = "application/json";
      payload = JSON.stringify(opts.body);
    }

    for (let attempt = 0; ; attempt++) {
      const cookie = await this.jar.getCookieString(url.toString());
      if (cookie) headers["cookie"] = cookie;
      else delete headers["cookie"];

      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          method,
          headers,
          body: payload,
          signal: opts.signal ?? AbortSignal.timeout(this.timeoutMs),
        });
      } catch (e) {
        const isTimeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
        // A network error leaves the request's fate unknown: it may have reached the
        // server. Only replay it when replaying is harmless.
        if (retryable && attempt < this.maxRetries) {
          await sleep(this.backoff(attempt));
          continue;
        }
        throw isTimeout
          ? new TimeoutError(`Request to ${url} timed out after ${this.timeoutMs}ms`, { cause: e })
          : new NetworkError(`Network error for ${url}: ${(e as Error).message}`, { cause: e });
      }

      // capture Set-Cookie
      let changed = false;
      for (const sc of res.headers.getSetCookie?.() ?? []) {
        try {
          await this.jar.setCookie(sc, url.toString());
          changed = true;
        } catch {
          /* ignore */
        }
      }
      if (changed) this.persist();

      // 401 → refresh once, then retry
      if (res.status === 401 && this.reauth && !opts._reauthed) {
        await this.reauth();
        return this.request<T>(method, path, { ...opts, _reauthed: true });
      }

      // retryable statuses — but only for a request that is safe to send twice.
      // A non-retryable 429 still surfaces as RateLimitError with `retryAfterMs`, so
      // the caller can decide; the SDK just refuses to decide for them.
      if ((res.status === 429 || res.status >= 500) && retryable && attempt < this.maxRetries) {
        const ra = res.headers.get("retry-after");
        const retryAfterMs = ra ? (Number.isNaN(Number(ra)) ? undefined : Number(ra) * 1000) : undefined;
        await sleep(this.backoff(attempt, retryAfterMs));
        continue;
      }

      const text = await res.text();
      if (!res.ok) {
        const ra = res.headers.get("retry-after");
        throw apiErrorFor(res.status, url.toString(), text, ra ? Number(ra) * 1000 : undefined);
      }
      if (!text) return undefined as T;

      // Every endpoint here answers JSON. Returning the raw text when it does not —
      // as this used to — hands back a Cloudflare challenge page typed as whatever the
      // caller asked for, and the failure surfaces much later as missing data.
      // Trust the body, not the content-type header, which can be wrong either way.
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ValidationError(url.toString(), "a JSON body", describe(text));
      }
    }
  }

  get<T>(path: string, query?: RequestOptions["query"]): Promise<T> {
    return this.request<T>("GET", path, { query });
  }
  post<T>(
    path: string,
    body?: unknown,
    query?: RequestOptions["query"],
    opts?: Pick<RequestOptions, "retry">,
  ): Promise<T> {
    return this.request<T>("POST", path, { body, query, ...opts });
  }
}
