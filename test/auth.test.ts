import { describe, it, expect } from "vitest";
import { HttpClient } from "../src/http.js";
import { EmailAuth } from "../src/auth/email.js";
import { AuthError } from "../src/errors.js";
import { mockFetch, json, noContent } from "./helpers.js";

describe("EmailAuth", () => {
  it("sendCode posts the email", async () => {
    const fetch = mockFetch(() => json(200, { success: true }));
    const auth = new EmailAuth(new HttpClient({ fetch }));
    await auth.sendCode("you@example.com");
    const call = fetch.recorded[0]!;
    expect(call.method).toBe("POST");
    expect(call.url).toContain("/api/proxy/auth/email/send-code");
    expect(call.body).toEqual({ email: "you@example.com" });
  });

  it("verifyCode sets cookies from the response BODY (not Set-Cookie)", async () => {
    const fetch = mockFetch(() =>
      json(200, { accessToken: "acc.jwt.tok", refreshToken: "ref123", customerId: "c1", expiresIn: 900 }),
    );
    const http = new HttpClient({ fetch });
    const auth = new EmailAuth(http);
    expect(http.hasSession()).toBe(false);
    await auth.verifyCode("you@example.com", "123456");
    expect(http.hasSession()).toBe(true);
    expect(fetch.recorded[0]!.body).toEqual({ email: "you@example.com", code: "123456", type: "LOGIN" });
  });

  it("verifyCode throws AuthError when no token is returned", async () => {
    const fetch = mockFetch(() => json(200, { error: "invalid_code" }));
    const auth = new EmailAuth(new HttpClient({ fetch }));
    await expect(auth.verifyCode("you@example.com", "000000")).rejects.toBeInstanceOf(AuthError);
  });

  it("refresh mints a fresh session via Set-Cookie", async () => {
    const fetch = mockFetch(() => noContent(["access_token=fresh; Path=/", "refresh_token=rot; Path=/"]));
    const http = new HttpClient({ fetch, cookie: "refresh_token=old" });
    const auth = new EmailAuth(http);
    await auth.refresh();
    expect(http.hasSession()).toBe(true);
    expect(fetch.recorded[0]!.url).toContain("/api/auth/refresh");
  });

  it("refresh throws AuthError if the session is not established", async () => {
    const fetch = mockFetch(() => noContent()); // 204 but no cookies set
    const http = new HttpClient({ fetch });
    const auth = new EmailAuth(http);
    await expect(auth.refresh()).rejects.toBeInstanceOf(AuthError);
  });
});
