import { describe, expect, it } from "vitest";
import { JupiterCard } from "../src/client.js";
import { ValidationError } from "../src/errors.js";
import { json, mockFetch } from "./helpers.js";

const client = (fetch: ReturnType<typeof mockFetch>) =>
  new JupiterCard({ auth: { kind: "cookie", cookie: "access_token=abc" }, fetch });

/**
 * cards and transactions were guarded first, because that is what the consumers use.
 * These endpoints were still casting whatever came back — the same trap: a body that is
 * not the promised shape would be handed over typed as if it were, and surface later as
 * `undefined.categories` rather than as an error.
 */
describe("every resource validates its response shape", () => {
  it.each([
    ["account.customer", (c: JupiterCard) => c.account.customer()],
    ["referral.info", (c: JupiterCard) => c.referral.info()],
    ["referral.summary", (c: JupiterCard) => c.referral.summary()],
    ["insights.spendSummary", (c: JupiterCard) => c.insights.spendSummary({ from: "2026-01-01", to: "2026-02-01" })],
    ["insights.topMerchants", (c: JupiterCard) => c.insights.topMerchants({ from: "2026-01-01", to: "2026-02-01" })],
    ["insights.globalSpend", (c: JupiterCard) => c.insights.globalSpend({ from: "2026-01-01", to: "2026-02-01" })],
  ])("%s throws on a body that is not an object", async (_name, call) => {
    const fetch = mockFetch(() => json(200, ["not", "an", "object"]));
    await expect(call(client(fetch))).rejects.toBeInstanceOf(ValidationError);
  });

  it("account.countries throws when the body is not an array", async () => {
    const fetch = mockFetch(() => json(200, { countries: [] })); // wrapped, not bare
    await expect(client(fetch).account.countries()).rejects.toBeInstanceOf(ValidationError);
  });

  it("account.countries accepts the bare array it actually returns", async () => {
    const fetch = mockFetch(() => json(200, [{ code: "US", name: "United States" }]));
    const countries = await client(fetch).account.countries();
    expect(countries).toHaveLength(1);
    expect(countries[0]!.code).toBe("US");
  });

  it("a Cloudflare page never reaches a caller as data", async () => {
    const fetch = mockFetch(
      () => new Response("<!doctype html><title>Just a moment…</title>", { status: 200, headers: { "content-type": "text/html" } }),
    );
    await expect(client(fetch).account.customer()).rejects.toBeInstanceOf(ValidationError);
  });
});
