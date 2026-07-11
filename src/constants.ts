/** jup.ag host that fronts the Jupiter Card account endpoints. */
export const JUP_BASE = "https://global.jup.ag";

/**
 * `x-auth-flow` header value. A web/email login session (what this SDK creates)
 * is authorized as `"legacy"`; the native app uses `"jupAg"`. Sending the wrong
 * value returns 401 even with a valid cookie.
 */
export const AUTH_FLOW = "legacy";

/** A realistic desktop-Chrome UA — required to pass global.jup.ag's Cloudflare. */
export const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Auth endpoints (relative to {@link JUP_BASE}). */
export const AUTH_ENDPOINTS = {
  sendCode: "/api/proxy/auth/email/send-code",
  verifyCode: "/api/proxy/auth/email/verify-code",
  refresh: "/api/auth/refresh",
} as const;

/**
 * Jupiter Card launched in 2025, so no transaction can predate it. Used to bound a
 * backwards crawl. Note this is a *floor*, not a window: a "only look N years back"
 * cap would eventually become the binding limit and silently truncate the oldest
 * history as the years pass.
 */
export const CARD_LAUNCH_YEAR = 2025;

/** Default network behaviour; override per-client via {@link JupiterCardOptions}. */
export const DEFAULTS = {
  /** Per-request timeout (ms). */
  timeoutMs: 30_000,
  /** Retry attempts for transient failures (429/5xx/network), on top of the first try. */
  maxRetries: 3,
  /** Base backoff (ms); grows exponentially with jitter. */
  retryBaseMs: 500,
  /** Cap for a single backoff wait (ms). */
  retryMaxMs: 8_000,
  /**
   * Hard ceiling on pages walked in one listing. Far beyond any real history; it
   * exists only so that an API which stops reporting `totalPages` while returning
   * full pages cannot spin forever.
   */
  maxPages: 500,
} as const;
