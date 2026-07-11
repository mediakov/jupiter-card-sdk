import { describe, expect, it } from "vitest";
import { JupiterCard } from "../src/client.js";
import { firstYearToQuery } from "../src/resources/transactions.js";
import { CARD_LAUNCH_YEAR, DEFAULTS } from "../src/constants.js";
import { json, mockFetch } from "./helpers.js";

const client = (fetch: ReturnType<typeof mockFetch>) =>
  new JupiterCard({ auth: { kind: "cookie", cookie: "access_token=abc" }, fetch });

const tx = (id: string, ts = "2026-03-01T00:00:00.000Z") => ({
  id,
  direction: "DEBIT",
  settlementAmount: "1.00",
  settlementCurrency: "USD",
  transactionTimestamp: ts,
});

describe("iterate", () => {
  // Page-based paging is racy: a transaction arriving mid-crawl shifts the later pages
  // down, so a record on a boundary is served twice. Uncorrected, it is double-counted.
  it("yields a transaction served on two pages only once", async () => {
    const fetch = mockFetch(
      () => json(200, { data: [tx("a"), tx("b")], meta: { totalPages: 2 } }),
      () => json(200, { data: [tx("b"), tx("c")], meta: { totalPages: 2 } }), // b shifted down
    );
    const ids = (await client(fetch).transactions.all({ limit: 2 })).map((t) => t.id);
    expect(ids).toEqual(["a", "b", "c"]);
  });

  // Without a ceiling, an API that keeps returning full pages and stops reporting
  // totalPages spins forever.
  it("stops at the page cap when the API never signals an end", async () => {
    const fetch = mockFetch(
      ...Array.from({ length: DEFAULTS.maxPages + 5 }, (_, i) => () =>
        json(200, { data: [tx(`tx_${i}_1`), tx(`tx_${i}_2`)] }), // always a full page, no meta
      ),
    );
    const all = await client(fetch).transactions.all({ limit: 2 });
    expect(fetch.recorded).toHaveLength(DEFAULTS.maxPages);
    expect(all).toHaveLength(DEFAULTS.maxPages * 2);
  });

  it("stops on a short page when totalPages is absent", async () => {
    const fetch = mockFetch(
      () => json(200, { data: [tx("a"), tx("b")] }),
      () => json(200, { data: [tx("c")] }), // short → last
    );
    expect(await client(fetch).transactions.all({ limit: 2 })).toHaveLength(3);
    expect(fetch.recorded).toHaveLength(2);
  });
});

describe("firstYearToQuery", () => {
  // Starts a year early: Jupiter's `year` filter does not bucket on UTC midnight, so a
  // transaction in the first hours of a year can be filed under the previous one.
  it("starts one year before the requested date", () => {
    expect(firstYearToQuery(new Date("2027-06-01T00:00:00Z"), 2027)).toBe(2026);
  });

  it("never goes back past the card's launch year", () => {
    expect(firstYearToQuery(new Date("2020-01-01T00:00:00Z"), 2027)).toBe(CARD_LAUNCH_YEAR);
  });

  it("never starts after the current year", () => {
    expect(firstYearToQuery(new Date("2030-01-01T00:00:00Z"), 2027)).toBe(2027);
  });
});

describe("since", () => {
  it("drops records older than `from` but keeps the boundary", async () => {
    const from = new Date("2026-03-01T00:00:00.000Z");
    const fetch = mockFetch(
      // firstYearToQuery(2026) → 2025, so 2025 is queried first, then 2026.
      () => json(200, { data: [tx("old", "2025-12-31T00:00:00.000Z")], meta: { totalPages: 1 } }),
      () =>
        json(200, {
          data: [tx("boundary", "2026-03-01T00:00:00.000Z"), tx("new", "2026-04-01T00:00:00.000Z")],
          meta: { totalPages: 1 },
        }),
    );
    const out = [];
    for await (const t of client(fetch).transactions.since(from)) out.push(t.id);
    expect(out).toEqual(["boundary", "new"]);
  });

  it("keeps a record whose timestamp cannot be read, rather than hiding it", async () => {
    const fetch = mockFetch(
      () => json(200, { data: [], meta: { totalPages: 1 } }),
      () => json(200, { data: [tx("bad", "not-a-date")], meta: { totalPages: 1 } }),
    );
    const out = [];
    for await (const t of client(fetch).transactions.since(new Date("2026-03-01T00:00:00.000Z"))) out.push(t.id);
    expect(out).toEqual(["bad"]);
  });

  // The API does not guarantee an ordering. Stopping at the first page that ends before
  // `from` is the obvious optimisation and it is wrong: one out-of-order row would end
  // the crawl and silently truncate everything behind it. This test is here to fail if
  // anyone adds that shortcut back.
  it("keeps paging past a page that ends before `from`", async () => {
    const fetch = mockFetch(
      () => json(200, { data: [], meta: { totalPages: 1 } }), // 2025
      () => json(200, { data: [tx("a", "2026-04-01T00:00:00.000Z"), tx("old", "2025-01-01T00:00:00.000Z")], meta: { totalPages: 2 } }),
      () => json(200, { data: [tx("wanted", "2026-05-01T00:00:00.000Z")], meta: { totalPages: 2 } }),
    );
    const out = [];
    for await (const t of client(fetch).transactions.since(new Date("2026-03-01T00:00:00.000Z"))) out.push(t.id);
    expect(out).toContain("wanted");
    expect(out).not.toContain("old");
  });

  it("rejects an invalid `from` instead of silently returning nothing", async () => {
    const fetch = mockFetch(() => json(200, { data: [] }));
    const it = client(fetch).transactions.since(new Date("garbage"));
    await expect(it.next()).rejects.toBeInstanceOf(RangeError);
  });
});
