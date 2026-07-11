import { describe, expect, it } from "vitest";
import { JupiterCard } from "../src/client.js";
import { EmailAuth } from "../src/auth/email.js";
import { HttpClient } from "../src/http.js";
import { AuthError, NetworkError, RateLimitError, ValidationError } from "../src/errors.js";
import { json, mockFetch } from "./helpers.js";

const cookieClient = (fetch: ReturnType<typeof mockFetch>) =>
  new JupiterCard({ auth: { kind: "cookie", cookie: "access_token=abc" }, fetch, maxRetries: 3 });

describe("retry policy", () => {
  it("retries an idempotent GET on 503", async () => {
    const fetch = mockFetch(
      () => json(503, { error: "down" }),
      () => json(200, { cards: [] }),
    );
    await cookieClient(fetch).cards.list();
    expect(fetch.recorded).toHaveLength(2);
  });

  // Replaying send-code is not a retry — it is a second email to the user, and a
  // deeper rate limit. The old client sent it 4 times on a 429.
  it("does NOT retry send-code on 429; it surfaces the rate limit", async () => {
    const fetch = mockFetch(() => json(429, { error: "slow down" }, undefined));
    const auth = new EmailAuth(new HttpClient({ fetch, maxRetries: 3 }));

    await expect(auth.sendCode("a@b.com")).rejects.toBeInstanceOf(RateLimitError);
    expect(fetch.recorded).toHaveLength(1); // exactly one email attempt
  });

  // A 5xx does not prove the server rejected the code — it may have accepted it and
  // then fallen over. Sending it again can spend a single-use code.
  it("does NOT retry verify-code on 500", async () => {
    const fetch = mockFetch(() => json(500, { error: "boom" }));
    const auth = new EmailAuth(new HttpClient({ fetch, maxRetries: 3 }));

    await expect(auth.verifyCode("a@b.com", "123456")).rejects.toThrow();
    expect(fetch.recorded).toHaveLength(1);
  });

  // A network error is the *worst* case for replaying a POST: the request may well have
  // reached the server, and we simply never saw the answer. Sending it again would be a
  // second email / a second attempt at a single-use code.
  it("does NOT replay send-code after a network error", async () => {
    const fetch = mockFetch(() => {
      throw new TypeError("fetch failed");
    });
    const auth = new EmailAuth(new HttpClient({ fetch, maxRetries: 3 }));

    await expect(auth.sendCode("a@b.com")).rejects.toBeInstanceOf(NetworkError);
    expect(fetch.recorded).toHaveLength(1);
  });

  it("does retry an idempotent GET after a network error", async () => {
    let calls = 0;
    const fetch = mockFetch(
      () => {
        calls++;
        throw new TypeError("fetch failed");
      },
      () => json(200, { cards: [] }),
    );
    await cookieClient(fetch).cards.list();
    expect(calls).toBe(1);
    expect(fetch.recorded).toHaveLength(2);
  });

  it("still retries a POST when the caller explicitly opts in", async () => {
    const fetch = mockFetch(
      () => json(503, {}),
      () => json(200, { ok: true }),
    );
    const http = new HttpClient({ fetch, maxRetries: 3 });
    await http.post("/api/proxy/whatever", { a: 1 }, undefined, { retry: true });
    expect(fetch.recorded).toHaveLength(2);
  });
});

describe("response validation", () => {
  // HttpClient is public API, so the JSON boundary must hold on its own — not only
  // because a resource guard happens to catch the mess downstream. A caller doing
  // `http.get<Thing>(...)` must not receive a Cloudflare page typed as a Thing.
  it("throws at the HTTP layer, not just in the resources", async () => {
    const fetch = mockFetch(
      () => new Response("<!doctype html><title>Just a moment…</title>", { status: 200, headers: { "content-type": "text/html" } }),
    );
    const http = new HttpClient({ fetch });
    await expect(http.get("/api/proxy/anything")).rejects.toBeInstanceOf(ValidationError);
  });

  // The content-type header can lie in either direction; trust the body.
  it("parses a JSON body even when the content-type says otherwise", async () => {
    const fetch = mockFetch(
      () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "text/plain" } }),
    );
    const http = new HttpClient({ fetch });
    await expect(http.get("/api/proxy/anything")).resolves.toEqual({ ok: true });
  });

  // The hole this closes: a Cloudflare challenge page came back as a string typed as
  // Paginated<Transaction>, and the failure surfaced later as missing transactions.
  it("throws on an HTML page where JSON was promised", async () => {
    const fetch = mockFetch(
      () => new Response("<!doctype html><title>Just a moment…</title>", { status: 200, headers: { "content-type": "text/html" } }),
    );
    await expect(cookieClient(fetch).transactions.list()).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws when the transactions body has no `data` array", async () => {
    const fetch = mockFetch(() => json(200, { message: "no transactions for you" }));
    await expect(cookieClient(fetch).transactions.list()).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws when `cards` is not an array", async () => {
    const fetch = mockFetch(() => json(200, { cards: null }));
    await expect(cookieClient(fetch).cards.list()).rejects.toBeInstanceOf(ValidationError);
  });

  // Valid JSON, but not an object — so the JSON boundary lets it through and only the
  // object check stands between it and `undefined.spendableBalance` downstream.
  it.each([[[]], ["a string"], [42], [null]])("throws when the balance body is %p, not an object", async (body) => {
    const fetch = mockFetch(() => json(200, body));
    await expect(cookieClient(fetch).cards.balance()).rejects.toBeInstanceOf(ValidationError);
  });

  // These messages land in the caller's logs, and an unexpected body is by definition
  // something we do not understand the contents of. Report the shape, never the bytes.
  it("does not leak the response body into the error message", async () => {
    const fetch = mockFetch(() => new Response("<html>secret-ish</html>", { status: 200, headers: { "content-type": "text/html" } }));
    const err: unknown = await cookieClient(fetch).cards.list().then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as Error).message).not.toContain("secret-ish");
    expect((err as Error).message).toContain("HTML/text page");
  });
});

describe("refresh", () => {
  // A 2xx that rotates nothing leaves the old, expired cookie in the jar. Checking
  // only for the cookie's *presence* would call that a success and then 401 forever.
  it("fails when the response rotates no new access token", async () => {
    const fetch = mockFetch(() => json(200, {})); // 200, but no Set-Cookie
    const http = new HttpClient({ fetch, cookie: "access_token=stale" });
    const auth = new EmailAuth(http);

    await expect(auth.refresh()).rejects.toBeInstanceOf(AuthError);
    expect(http.sessionToken()).toBe("stale");
  });

  it("succeeds when a new access token is issued", async () => {
    const fetch = mockFetch(() => json(200, {}, ["access_token=fresh; Path=/"]));
    const http = new HttpClient({ fetch, cookie: "access_token=stale" });
    await new EmailAuth(http).refresh();
    expect(http.sessionToken()).toBe("fresh");
  });
});

describe("verifyCode", () => {
  it("rejects a response missing the refresh token", async () => {
    // Half a session: works for ~15 minutes, then dies with no way back.
    const fetch = mockFetch(() => json(200, { accessToken: "a" }));
    const auth = new EmailAuth(new HttpClient({ fetch }));
    await expect(auth.verifyCode("a@b.com", "123456")).rejects.toBeInstanceOf(AuthError);
  });
});
