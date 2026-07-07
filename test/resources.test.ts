import { describe, it, expect } from "vitest";
import { JupiterCard } from "../src/client.js";
import { mockFetch, json } from "./helpers.js";

function client(fetch: ReturnType<typeof mockFetch>) {
  return new JupiterCard({ auth: { kind: "cookie", cookie: "access_token=abc" }, fetch });
}

describe("resources", () => {
  it("cards.list unwraps the cards array", async () => {
    const fetch = mockFetch(() => json(200, { cards: [{ id: "card_1", last4: "1234" }] }));
    const cards = await client(fetch).cards.list();
    expect(cards).toHaveLength(1);
    expect(cards[0]!.last4).toBe("1234");
  });

  it("cards.balance returns typed balance", async () => {
    const fetch = mockFetch(() => json(200, { currency: "USD", spendableBalance: 100.5, withdrawableBalance: 100.5 }));
    const b = await client(fetch).cards.balance();
    expect(b.currency).toBe("USD");
    expect(b.spendableBalance).toBe(100.5);
  });

  it("account.customer hits the right path", async () => {
    const fetch = mockFetch(() => json(200, { id: "c1", email: "a@b.c", status: "ACTIVE" }));
    const me = await client(fetch).account.customer();
    expect(me.email).toBe("a@b.c");
    expect(fetch.recorded[0]!.url).toContain("/api/proxy/customer");
  });

  it("insights.spendSummary passes from/to", async () => {
    const fetch = mockFetch(() => json(200, { currency: "USD", total: "10.00", breakdown: [] }));
    await client(fetch).insights.spendSummary({ from: "2026-07-01T00:00:00Z", to: "2026-07-31T00:00:00Z" });
    const url = fetch.recorded[0]!.url;
    expect(url).toContain("from=2026-07-01");
    expect(url).toContain("to=2026-07-31");
  });
});

describe("transactions pagination", () => {
  it("iterate walks all pages via meta.totalPages", async () => {
    const page = (n: number) =>
      json(200, {
        data: [{ id: `tx_${n}a` }, { id: `tx_${n}b` }],
        meta: { page: n, limit: 2, total: 4, totalPages: 2 },
      });
    const fetch = mockFetch(() => page(1), () => page(2));
    const ids: string[] = [];
    for await (const tx of client(fetch).transactions.iterate({ year: 2026 })) ids.push(tx.id);
    expect(ids).toEqual(["tx_1a", "tx_1b", "tx_2a", "tx_2b"]);
    expect(fetch.recorded).toHaveLength(2);
  });

  it("all() collects every transaction", async () => {
    const fetch = mockFetch(() => json(200, { data: [{ id: "tx_1" }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }));
    const all = await client(fetch).transactions.all();
    expect(all.map((t) => t.id)).toEqual(["tx_1"]);
  });

  it("iterate stops on an empty page", async () => {
    const fetch = mockFetch(() => json(200, { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }));
    const ids: string[] = [];
    for await (const tx of client(fetch).transactions.iterate()) ids.push(tx.id);
    expect(ids).toEqual([]);
  });
});

describe("client", () => {
  it("isAuthenticated reflects the session cookie", () => {
    expect(client(mockFetch()).isAuthenticated()).toBe(true);
    const noSession = new JupiterCard({ auth: { kind: "cookie", cookie: "foo=bar" }, fetch: mockFetch() });
    expect(noSession.isAuthenticated()).toBe(false);
  });

  it("login helpers throw in cookie mode", async () => {
    await expect(client(mockFetch()).login.sendCode()).rejects.toThrow(/email auth mode/);
  });
});
