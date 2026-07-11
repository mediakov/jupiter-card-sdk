import type { HttpClient } from "../http.js";
import { AUTH_ENDPOINTS } from "../constants.js";
import { AuthError } from "../errors.js";

interface VerifyResponse {
  accessToken: string;
  refreshToken: string;
  customerId?: string;
  sessionId?: string;
  expiresIn?: number;
}

/**
 * Jupiter's email one-time-code auth, entirely over jup.ag's own endpoints — no
 * Privy SDK, no browser.
 *
 * `verify-code` returns the tokens in its **response body** (it does not set
 * cookies); the SDK turns them into the `access_token` / `refresh_token` cookies
 * that authorize the API. The access token lasts ~15 minutes; {@link refresh}
 * mints a new one from the refresh token (valid ~7 days).
 */
export class EmailAuth {
  constructor(private readonly http: HttpClient) {}

  /**
   * Send a one-time login code to `email`.
   *
   * Not retried on failure (POSTs are not idempotent by default). A 429 here surfaces
   * as {@link RateLimitError} rather than being hammered: every replay is another
   * email in the user's inbox and a deeper rate limit.
   */
  async sendCode(email: string): Promise<void> {
    await this.http.post<unknown>(AUTH_ENDPOINTS.sendCode, { email });
  }

  /**
   * Complete login with the emailed code. On success the session cookies are
   * established and persisted (if a `sessionFile` was configured).
   *
   * Not retried on failure: the code is single-use, and replaying a request the server
   * may already have accepted would spend it.
   *
   * @throws {AuthError} if the code is wrong/expired or no token is returned.
   */
  async verifyCode(email: string, code: string): Promise<void> {
    const res = await this.http.post<VerifyResponse>(AUTH_ENDPOINTS.verifyCode, { email, code, type: "LOGIN" });
    if (!res?.accessToken || !res.refreshToken) {
      // Without *both*, the session cannot outlive the access token's ~15 minutes; a
      // half-established session would work now and mysteriously die later.
      throw new AuthError(401, AUTH_ENDPOINTS.verifyCode, "verify-code returned no token pair (wrong/expired code?)");
    }
    this.http.setCookiePairs({
      access_token: res.accessToken,
      refresh_token: res.refreshToken,
      oauth_flow: "login",
    });
  }

  /**
   * Mint a fresh access token from the refresh-token cookie.
   * `POST /api/auth/refresh` → 204 + Set-Cookie: rotated access_token +
   * refresh_token (captured automatically by the HTTP layer).
   * @throws {AuthError} if the refresh token is gone/expired (re-login needed).
   */
  async refresh(): Promise<void> {
    const before = this.http.sessionToken();
    // _reauthed: true prevents a 401 here from recursing back into reauth.
    await this.http.request("POST", AUTH_ENDPOINTS.refresh, { _reauthed: true });
    const after = this.http.sessionToken();
    // Presence is not proof: a 2xx that rotates nothing leaves the *old, expired*
    // cookie in the jar, which would pass a `hasSession()` check and then 401 forever.
    // The token must actually have changed.
    if (after === undefined || after === before) {
      throw new AuthError(401, AUTH_ENDPOINTS.refresh, "refresh did not issue a new access token — re-login required");
    }
  }
}
