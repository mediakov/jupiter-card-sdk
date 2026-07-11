import { describe, expect, it } from "vitest";
import {
  directionSign,
  isBookable,
  isHold,
  parseMoney,
  signedAmount,
  signedOriginalAmount,
  transactionDate,
} from "../src/money.js";
import type { Transaction } from "../src/types.js";

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: "tx_1",
  direction: "DEBIT",
  settlementCurrency: "USD",
  settlementAmount: "10.50",
  transactionTimestamp: "2026-03-01T12:00:00.000Z",
  ...over,
});

describe("parseMoney", () => {
  it("parses a decimal string", () => {
    expect(parseMoney("123.45")).toBe(123.45);
    expect(parseMoney(0)).toBe(0);
  });

  // Number("") === 0 and Number(null) === 0: the values JS most wants to turn into a
  // real, wrong number are exactly the ones that must not become one.
  it.each([null, undefined, "", "abc", NaN, Infinity])("returns null, not 0, for %p", (value) => {
    expect(parseMoney(value as never)).toBeNull();
  });
});

describe("directionSign", () => {
  it("maps the two known directions", () => {
    expect(directionSign({ direction: "CREDIT" })).toBe(1);
    expect(directionSign({ direction: "DEBIT" })).toBe(-1);
  });

  // The bug this SDK exists to prevent: `direction === "CREDIT" ? 1 : -1` books an
  // unknown direction as money leaving the account.
  it.each(["REVERSAL", "", null, undefined])("returns null — never -1 — for %p", (direction) => {
    expect(directionSign({ direction } as never)).toBeNull();
  });
});

describe("signedAmount", () => {
  it("is negative for a debit and positive for a credit", () => {
    expect(signedAmount(tx({ direction: "DEBIT", settlementAmount: "10.50" }))).toBe(-10.5);
    expect(signedAmount(tx({ direction: "CREDIT", settlementAmount: "10.50" }))).toBe(10.5);
  });

  it("is null when the direction is unknown", () => {
    expect(signedAmount(tx({ direction: "REFUND" }))).toBeNull();
  });

  it("is null — not 0 — when the amount is unparseable", () => {
    expect(signedAmount(tx({ settlementAmount: "" }))).toBeNull();
    expect(signedAmount(tx({ settlementAmount: null }))).toBeNull();
  });
});

describe("signedOriginalAmount", () => {
  it("returns the pre-conversion amount, signed", () => {
    const t = tx({ direction: "DEBIT", settlementCurrency: "USD", transactionCurrency: "EUR", transactionAmount: "9.00" });
    expect(signedOriginalAmount(t)).toEqual({ sum: -9, currency: "EUR" });
  });

  it("is null when no conversion happened", () => {
    const t = tx({ settlementCurrency: "USD", transactionCurrency: "USD", transactionAmount: "10.50" });
    expect(signedOriginalAmount(t)).toBeNull();
  });

  it("is null when the original amount is unreadable", () => {
    const t = tx({ transactionCurrency: "EUR", transactionAmount: "n/a" });
    expect(signedOriginalAmount(t)).toBeNull();
  });
});

describe("transactionDate", () => {
  it("parses a timestamp", () => {
    expect(transactionDate(tx())?.toISOString()).toBe("2026-03-01T12:00:00.000Z");
  });

  // `new Date("nope")` is an Invalid Date, which propagates silently. null does not.
  it.each(["nope", "", null, undefined])("returns null rather than an Invalid Date for %p", (ts) => {
    expect(transactionDate({ transactionTimestamp: ts as never })).toBeNull();
  });
});

describe("isHold", () => {
  it("is true for an unsettled card authorisation", () => {
    expect(isHold(tx({ card: { settlementTimestamp: null } }))).toBe(true);
  });

  it("is false once settled, and for non-card movements", () => {
    expect(isHold(tx({ card: { settlementTimestamp: "2026-03-02T00:00:00Z" } }))).toBe(false);
    expect(isHold(tx({ card: null }))).toBe(false);
  });
});

describe("isBookable", () => {
  it("is true only when direction, amount and date can all be read", () => {
    expect(isBookable(tx())).toBe(true);
    expect(isBookable(tx({ direction: "MYSTERY" }))).toBe(false);
    expect(isBookable(tx({ settlementAmount: "" }))).toBe(false);
    expect(isBookable(tx({ transactionTimestamp: "nope" }))).toBe(false);
  });
});
