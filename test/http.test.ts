import { describe, it, expect } from "vitest";
import { HttpClient } from "../src/http.js";
import { ApiError, AuthError, RateLimitError } from "../src/errors.js";
import { mockFetch, json, noContent } from "./helpers.js";

describe("HttpClient headers", () => {
  it("sends x-auth-flow, browser UA, and the session cookie", async () => {
    const fetch = mockFetch(() => json(200, { ok: true }));
    const http = new HttpClient({ fetch, cookie: "access_token=abc" });
    await http.get("/api/proxy/customer");

    const call = fetch.recorded[0]!;
    expect(call.headers["x-auth-flow"]).toBe("legacy");
    expect(call.headers["user-agent"]).toContain("Chrome");
    expect(call.headers["cookie"]).toContain("access_token=abc");
    expect(call.url).toBe("https://global.jup.ag/api/proxy/customer");
  });

  it("serializes query params", async () => {
    const fetch = mockFetch(() => json(200, { data: [] }));
    const http = new HttpClient({ fetch, cookie: "access_token=abc" });
    await http.get("/api/proxy/transactions", { page: 2, limit: 20, year: 2026 });
    expect(fetch.recorded[0]!.url).toBe(
      "https://global.jup.ag/api/proxy/transactions?page=2&limit=20&year=2026",
    );
  });
});

describe("HttpClient errors", () => {
  it("throws AuthError on 401 with no reauth", async () => {
    const fetch = mockFetch(() => json(401, { type: "unauthorized" }));
    const http = new HttpClient({ fetch, cookie: "access_token=x", maxRetries: 0 });
    await expect(http.get("/x")).rejects.toBeInstanceOf(AuthError);
  });

  it("throws RateLimitError on 429 (after retries)", async () => {
    const fetch = mockFetch(
      () => json(429, { type: "rate_limited" }),
      () => json(429, { type: "rate_limited" }),
    );
    const http = new HttpClient({ fetch, cookie: "access_token=x", maxRetries: 1 });
    await expect(http.get("/x")).rejects.toBeInstanceOf(RateLimitError);
  });

  it("throws ApiError on 400", async () => {
    const fetch = mockFetch(() => json(400, { type: "bad_request" }));
    const http = new HttpClient({ fetch, cookie: "access_token=x", maxRetries: 0 });
    await expect(http.get("/x")).rejects.toMatchObject({ status: 400, code: "bad_request" });
  });
});

describe("HttpClient retry", () => {
  it("retries 503 then succeeds", async () => {
    const fetch = mockFetch(
      () => json(503, { error: "upstream" }),
      () => json(200, { ok: true }),
    );
    const http = new HttpClient({ fetch, cookie: "access_token=x", maxRetries: 3 });
    await expect(http.get<{ ok: boolean }>("/x")).resolves.toEqual({ ok: true });
    expect(fetch.recorded).toHaveLength(2);
  });
});

describe("HttpClient reauth on 401", () => {
  it("calls reauth once, then retries and succeeds", async () => {
    let reauthCount = 0;
    const fetch = mockFetch(
      () => json(401, { type: "unauthorized" }), // first attempt: expired
      () => json(200, { id: "cust_1" }), // retry after reauth
    );
    const http = new HttpClient({
      fetch,
      cookie: "access_token=stale",
      reauth: async () => {
        reauthCount++;
      },
    });
    const r = await http.get<{ id: string }>("/api/proxy/customer");
    expect(r.id).toBe("cust_1");
    expect(reauthCount).toBe(1);
  });

  it("does not loop forever if reauth doesn't fix it", async () => {
    const fetch = mockFetch(
      () => json(401, {}),
      () => json(401, {}),
    );
    const http = new HttpClient({ fetch, cookie: "access_token=x", reauth: async () => {}, maxRetries: 0 });
    await expect(http.get("/x")).rejects.toBeInstanceOf(AuthError);
    expect(fetch.recorded).toHaveLength(2); // original + one post-reauth retry
  });
});

describe("HttpClient cookie capture", () => {
  it("stores Set-Cookie from responses", async () => {
    const fetch = mockFetch(() => noContent(["access_token=fresh; Path=/", "refresh_token=r2; Path=/"]));
    const http = new HttpClient({ fetch });
    expect(http.hasSession()).toBe(false);
    await http.post("/api/auth/refresh");
    expect(http.hasSession()).toBe(true);
  });
});
