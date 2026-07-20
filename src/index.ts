export { JupiterCard } from "./client.js";
export type { JupiterCardOptions, JupiterCardAuth } from "./client.js";

export { HttpClient, IDEMPOTENT_METHODS } from "./http.js";
export type { HttpOptions, RequestOptions } from "./http.js";

export { EmailAuth } from "./auth/email.js";

export { Cards } from "./resources/cards.js";
export { Transactions, firstYearToQuery } from "./resources/transactions.js";
export type { TransactionListParams, TransactionSinceParams } from "./resources/transactions.js";
export { Insights } from "./resources/insights.js";
export { Account } from "./resources/account.js";
export { Referral } from "./resources/referral.js";

/**
 * Reading money out of a transaction. Use these rather than touching `direction` and
 * `settlementAmount` by hand — they return `null` instead of guessing. See `money.ts`.
 */
export {
  parseMoney,
  directionSign,
  signedAmount,
  signedOriginalAmount,
  transactionDate,
  isDeclined,
  isHold,
  isBookable,
} from "./money.js";

export {
  JupiterError,
  ApiError,
  AuthError,
  RateLimitError,
  ValidationError,
  NetworkError,
  TimeoutError,
} from "./errors.js";

export { JUP_BASE, AUTH_FLOW, AUTH_ENDPOINTS, DEFAULTS, CARD_LAUNCH_YEAR } from "./constants.js";

export * from "./types.js";
