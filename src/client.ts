import { HttpClient } from "./http.js";
import { EmailAuth } from "./auth/email.js";
import { Cards } from "./resources/cards.js";
import { Transactions } from "./resources/transactions.js";
import { Insights } from "./resources/insights.js";
import { Account } from "./resources/account.js";
import { Referral } from "./resources/referral.js";

/** How the client authenticates. */
export type JupiterCardAuth =
  /**
   * Email one-time-code login. The session is persisted to `sessionFile` and
   * refreshed automatically, so after the first code entry it runs unattended
   * for the refresh-token lifetime (~7 days).
   */
  | { kind: "email"; email: string; sessionFile?: string }
  /**
   * Bring your own session cookie string, e.g. `"access_token=…; refresh_token=…"`.
   * No auto-refresh beyond what the cookies allow.
   */
  | { kind: "cookie"; cookie: string };

export interface JupiterCardOptions {
  auth: JupiterCardAuth;
  /** Override the API base URL (default `https://global.jup.ag`). */
  baseUrl?: string;
  /** Per-request timeout in ms (default 30000). */
  timeoutMs?: number;
  /** Retry attempts for 429/5xx/network errors (default 3). */
  maxRetries?: number;
  /** Injectable fetch (for testing). Defaults to global `fetch`. */
  fetch?: typeof fetch;
}

/**
 * Client for the Jupiter Card (jup.ag / Jupiter Global) account API.
 *
 * ```ts
 * import { JupiterCard } from "jupiter-card-sdk";
 *
 * const jc = new JupiterCard({
 *   auth: { kind: "email", email: "you@example.com", sessionFile: ".jup-session.json" },
 * });
 *
 * if (!jc.isAuthenticated()) {
 *   await jc.login.sendCode();
 *   await jc.login.verify("123456"); // code from your inbox
 * }
 *
 * const balance = await jc.cards.balance();
 * for await (const tx of jc.transactions.iterate({ year: 2026 })) { ... }
 * ```
 *
 * Auth, cookie handling, token refresh, retries and timeouts are all handled
 * internally; the resource methods are plain typed calls.
 */
export class JupiterCard {
  /** Low-level HTTP client (cookie jar, retries). Rarely needed directly. */
  readonly http: HttpClient;
  private readonly auth: JupiterCardAuth;
  private readonly email?: EmailAuth;

  /** Cards, balances, cashback. */
  readonly cards: Cards;
  /** Card transactions (list, get, iterate, categories). */
  readonly transactions: Transactions;
  /** Spend analytics. */
  readonly insights: Insights;
  /** Customer profile + reference data. */
  readonly account: Account;
  /** Referral program + standing. */
  readonly referral: Referral;

  constructor(opts: JupiterCardOptions) {
    this.auth = opts.auth;
    this.http = new HttpClient({
      baseUrl: opts.baseUrl,
      timeoutMs: opts.timeoutMs,
      maxRetries: opts.maxRetries,
      fetch: opts.fetch,
      cookie: opts.auth.kind === "cookie" ? opts.auth.cookie : undefined,
      sessionFile: opts.auth.kind === "email" ? (opts.auth.sessionFile ?? ".jup-session.json") : undefined,
      reauth: opts.auth.kind === "email" ? () => this.email!.refresh() : undefined,
    });
    if (opts.auth.kind === "email") this.email = new EmailAuth(this.http);

    this.cards = new Cards(this.http);
    this.transactions = new Transactions(this.http);
    this.insights = new Insights(this.http);
    this.account = new Account(this.http);
    this.referral = new Referral(this.http);
  }

  /** True if a session cookie is present (persisted or supplied). */
  isAuthenticated(): boolean {
    return this.http.hasSession();
  }

  /**
   * Email-login helpers. Only meaningful when constructed with
   * `auth.kind === "email"`.
   */
  get login() {
    const email = this.email;
    const addr = this.auth.kind === "email" ? this.auth.email : "";
    return {
      /** Send the one-time code to the configured email address. */
      sendCode: async (): Promise<void> => {
        if (!email) throw new Error("login is only available in email auth mode");
        await email.sendCode(addr);
      },
      /** Complete login with the code from the email. */
      verify: async (code: string): Promise<void> => {
        if (!email) throw new Error("login is only available in email auth mode");
        await email.verifyCode(addr, code);
      },
      /** Force a session refresh (normally automatic on 401). */
      refresh: async (): Promise<void> => {
        if (!email) throw new Error("refresh is only available in email auth mode");
        await email.refresh();
      },
    };
  }
}
