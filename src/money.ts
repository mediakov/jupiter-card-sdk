/**
 * Reading money out of a transaction.
 *
 * These accessors exist because the obvious one-liner is wrong:
 *
 * ```ts
 * const sum = (tx.direction === "CREDIT" ? 1 : -1) * Number(tx.settlementAmount); // ✗
 * ```
 *
 * It treats *everything that is not `CREDIT`* as money leaving the account — so a
 * missing `direction`, or a value Jupiter adds later (a `REVERSAL`, a `REFUND`),
 * books income as an expense. And `Number("")` is `NaN` while `Number(null)` is `0`,
 * so a malformed amount silently becomes a real, wrong number.
 *
 * Every accessor here returns `null` for a record it cannot read honestly. `null`
 * means *"this cannot be represented"* — skip the record, or surface it. It never
 * means zero.
 */
import type { Transaction } from "./types.js";

/**
 * Parse a decimal money string (`"123.45"`) to a number.
 * Returns `null` for anything that is not a finite number — including `null`,
 * `undefined`, `""` and `"abc"`, each of which `Number()` would happily turn into
 * `0` or `NaN`.
 *
 * Note: the API sends amounts as strings to preserve decimal precision, and a JS
 * `number` is a binary float. That is exact for card-sized amounts but not for
 * arbitrary-precision arithmetic — if you sum a great many of these, use a decimal
 * library on the raw strings instead.
 */
export function parseMoney(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * `+1` for money entering the account, `-1` for money leaving it, `null` if the
 * direction is absent or is a value this SDK does not know.
 *
 * An unknown direction is not an error and not a debit — it is *unknown*, and the
 * caller must decide. Guessing here is how income becomes an expense.
 */
export function directionSign(tx: Pick<Transaction, "direction">): 1 | -1 | null {
  if (tx.direction === "CREDIT") return 1;
  if (tx.direction === "DEBIT") return -1;
  return null;
}

/**
 * The settlement amount, signed: negative for a debit, positive for a credit.
 * `null` if the direction is unknown or the amount is unparseable.
 */
export function signedAmount(tx: Pick<Transaction, "direction" | "settlementAmount">): number | null {
  const sign = directionSign(tx);
  const amount = parseMoney(tx.settlementAmount);
  return sign === null || amount === null ? null : sign * amount;
}

/**
 * The original (pre-conversion) amount and currency, signed — for a purchase made
 * in a currency other than the settlement one. `null` when the transaction did not
 * involve a conversion, or when either part is unreadable.
 */
export function signedOriginalAmount(
  tx: Pick<Transaction, "direction" | "settlementCurrency" | "transactionCurrency" | "transactionAmount">,
): { sum: number; currency: string } | null {
  const currency = tx.transactionCurrency;
  if (currency == null || currency === "" || currency === tx.settlementCurrency) return null;
  const sign = directionSign(tx);
  const amount = parseMoney(tx.transactionAmount);
  return sign === null || amount === null ? null : { sum: sign * amount, currency };
}

/**
 * The transaction timestamp as a `Date`, or `null` if it is missing or unparseable.
 * An `Invalid Date` propagates silently through most code; `null` does not.
 */
export function transactionDate(tx: Pick<Transaction, "transactionTimestamp">): Date | null {
  if (tx.transactionTimestamp == null || tx.transactionTimestamp === "") return null;
  const date = new Date(tx.transactionTimestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * True while a card authorisation is still pending settlement (a *hold*): the amount
 * may yet change or vanish. Only card transactions can be held; an on-chain deposit
 * or withdrawal is never one.
 */
export function isHold(tx: Pick<Transaction, "card">): boolean {
  return tx.card != null && tx.card.settlementTimestamp == null;
}

/**
 * True if every part of the transaction needed to book it — direction, amount, and
 * timestamp — could be read. A `false` here is the signal to skip the record rather
 * than write a guess into a ledger.
 */
export function isBookable(tx: Transaction): boolean {
  return signedAmount(tx) !== null && transactionDate(tx) !== null;
}
