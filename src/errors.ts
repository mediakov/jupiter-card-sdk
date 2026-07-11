/**
 * Error hierarchy. Everything the SDK throws for a failed request derives from
 * {@link JupiterError}, so you can `catch (e) { if (e instanceof JupiterError) … }`.
 */
export class JupiterError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    // preserve prototype chain when targeting ES5-ish runtimes
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** A non-2xx HTTP response. Base for the more specific status errors. */
export class ApiError extends JupiterError {
  constructor(
    /** HTTP status code. */
    public readonly status: number,
    /** Request URL. */
    public readonly url: string,
    /** Raw response body (truncated). */
    public readonly body: string,
    /** Parsed API error code/type, if the body was JSON. */
    public readonly code?: string,
  ) {
    super(`HTTP ${status} ${code ? `(${code}) ` : ""}for ${url}: ${body.slice(0, 300)}`);
  }
}

/** 401/403 — the session is missing, invalid, or could not be refreshed. */
export class AuthError extends ApiError {}

/** 429 — rate limited. `retryAfterMs` is set when the server sends `Retry-After`. */
export class RateLimitError extends ApiError {
  constructor(
    status: number,
    url: string,
    body: string,
    code: string | undefined,
    public readonly retryAfterMs?: number,
  ) {
    super(status, url, body, code);
  }
}

/**
 * The response did not have the shape the endpoint promises — e.g. a Cloudflare
 * challenge page where a JSON list was expected.
 *
 * This is deliberately fatal. The alternative is to hand the caller a value that
 * TypeScript claims is a `Transaction[]` but isn't, which surfaces much later as
 * a nonsensical balance rather than an error.
 */
export class ValidationError extends JupiterError {
  constructor(
    /** Request URL. */
    public readonly url: string,
    /** What the endpoint was expected to return. */
    public readonly expected: string,
    /** A short, non-sensitive description of what came back. */
    public readonly received: string,
  ) {
    super(`Unexpected response from ${url}: expected ${expected}, got ${received}`);
  }
}

/** A network-level failure (DNS, connection reset, timeout/abort). */
export class NetworkError extends JupiterError {}

/** The request exceeded the configured timeout. */
export class TimeoutError extends NetworkError {}

/**
 * Build the right ApiError subclass for a status code.
 * @internal
 */
export function apiErrorFor(status: number, url: string, body: string, retryAfterMs?: number): ApiError {
  let code: string | undefined;
  try {
    const j = JSON.parse(body);
    code = j?.type ?? j?.code ?? j?.error;
  } catch {
    /* not JSON */
  }
  if (status === 401 || status === 403) return new AuthError(status, url, body, code);
  if (status === 429) return new RateLimitError(status, url, body, code, retryAfterMs);
  return new ApiError(status, url, body, code);
}
