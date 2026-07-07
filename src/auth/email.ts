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

  /** Send a one-time login code to `email`. */
  async sendCode(email: string): Promise<void> {
    await this.http.post<{ success: boolean }>(AUTH_ENDPOINTS.sendCode, { email });
  }

  /**
   * Complete login with the emailed code. On success the session cookies are
   * established and persisted (if a `sessionFile` was configured).
   * @throws {AuthError} if the code is wrong/expired or no token is returned.
   */
  async verifyCode(email: string, code: string): Promise<void> {
    const res = await this.http.post<VerifyResponse>(AUTH_ENDPOINTS.verifyCode, { email, code, type: "LOGIN" });
    if (!res?.accessToken) {
      throw new AuthError(401, AUTH_ENDPOINTS.verifyCode, "verify-code returned no accessToken (wrong/expired code?)");
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
    // _reauthed: true prevents a 401 here from recursing back into reauth.
    await this.http.request("POST", AUTH_ENDPOINTS.refresh, { _reauthed: true });
    if (!this.http.hasSession()) {
      throw new AuthError(401, AUTH_ENDPOINTS.refresh, "refresh failed — re-login required");
    }
  }
}
