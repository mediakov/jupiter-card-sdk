/**
 * Response models for the Jupiter Card API, derived from live introspection of
 * `ag.jup.jupiter.android` / global.jup.ag (v3.7.0).
 *
 * Monetary values come back as **strings** (to preserve decimal precision) —
 * except `cards/balance`, which returns numbers. Amounts are decimal strings
 * like `"123.45"`; parse with care (e.g. a decimal library) if you do math.
 */

/** A decimal money amount as a string, e.g. `"123.45"`. Preserves precision. */
export type MoneyString = string;

/**
 * A known string literal union that still accepts future/unknown values from
 * the API without a type error, while keeping editor autocomplete for the
 * known ones.
 */
export type Open<T extends string> = T | (string & {});

// ─── Customer ────────────────────────────────────────────────────────────────

export type CustomerStatus = Open<"ACTIVE" | "FROZEN" | "CLOSED" | "PENDING">;

export interface Customer {
  id: string;
  email: string;
  /** e.g. "google". */
  authProvider: string;
  authProviderId: string;
  status: CustomerStatus;
  /** ISO alpha-2 country code, e.g. "US". */
  countryOfResidence: string;
  state: string | null;
  firstName: string;
  onboardedAt: string;
  freezeTypes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CountryState {
  name: string;
  code: string;
  cardSupported: boolean;
}

export interface Country {
  name: string;
  /** ISO alpha-2. */
  code: string;
  /** ISO alpha-3. */
  alpha3: string;
  /** ISO numeric code (present for most countries). */
  numeric?: string;
  flagUrl: string;
  phoneCode: string;
  cardSupported: boolean;
  states?: CountryState[];
}

// ─── Cards ───────────────────────────────────────────────────────────────────

export type CardStatus = Open<"ACTIVE" | "FROZEN" | "CLOSED" | "PENDING">;

export interface Card {
  id: string;
  customerId?: string | null;
  /** Card issuer/provider. */
  provider?: string | null;
  /**
   * The account the card draws on. Several cards can share one.
   *
   * This is the only stable identifier for the underlying account — deriving an
   * account identity from any other field (the card id, the last 4) makes it change
   * when a card is reissued, which duplicates the account in a downstream ledger
   * permanently. If it is absent, do not substitute something else.
   */
  cardAccountId?: string | null;
  status?: CardStatus | null;
  /** Card art / design identifier. */
  design?: string | null;
  imageUrl?: string | null;
  last4?: string | null;
  /** Two-digit month, e.g. "07". */
  expirationMonth?: string | null;
  /** Four-digit year, e.g. "2028". */
  expirationYear?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CardsResponse {
  cards: Card[];
}

export interface CardBalance {
  /** e.g. "USD". */
  currency?: string | null;
  /** NOTE: numbers here (not strings). May be absent — do not read as `0`. */
  spendableBalance?: number | null;
  withdrawableBalance?: number | null;
}

export interface CashbackBalance {
  currency: string;
  /** Decimal string, e.g. "5.00". */
  balance: MoneyString;
}

// ─── Transactions ────────────────────────────────────────────────────────────

export type TransactionDirection = Open<"DEBIT" | "CREDIT">;
export type TransactionType = Open<"CARD" | "DEPOSIT" | "WITHDRAWAL">;

export interface TransactionCategory {
  id: string;
  name: string;
  icon: string;
}

export interface TransactionFees {
  localAmount: MoneyString;
  localCurrency: string;
  finalAmountUsd: MoneyString;
  visaConversionFeeUsd: MoneyString;
  visaConversionRate: MoneyString;
  amountBeforeFeeUsd: MoneyString;
  exchangeRate: MoneyString;
}

/**
 * Lifecycle status of a card purchase.
 *
 * Observed live: `COMPLETED` (settled), `AUTHORIZED` (a pending hold), and
 * `INSUFFICIENT_FUNDS` (a decline — no money moved). Left `Open<>` because a card program
 * emits more decline codes than any one account will ever show; treat an unrecognised value
 * as "not a settled/held charge" rather than assume it is spendable — see {@link isDeclined}.
 */
export type CardTransactionStatus = Open<"COMPLETED" | "AUTHORIZED" | "INSUFFICIENT_FUNDS">;

/** Card-specific detail present on `type: "CARD"` transactions. */
export interface TransactionCard {
  last4?: string | null;
  merchantName?: string | null;
  merchantLogoUrl?: string | null;
  /** ISO 18245 MCC. */
  merchantCategoryCode?: string | null;
  /** Present on the single-transaction endpoint. */
  category?: TransactionCategory;
  /** Present on the single-transaction endpoint. */
  canApplyToSimilar?: boolean;
  /** User note, if set. */
  note?: string | null;
  /**
   * Where the charge is in its lifecycle. A decline (e.g. `INSUFFICIENT_FUNDS`) still
   * carries a full amount and a valid timestamp, so this field is the ONLY signal that no
   * money moved. Read it through {@link isDeclined} rather than comparing by hand.
   */
  status?: CardTransactionStatus | null;
  /** `null` while the authorisation is still a hold — see {@link isHold}. */
  settlementTimestamp?: string | null;
  fees?: TransactionFees | null;
}

/**
 * A card transaction.
 *
 * The money-bearing fields are typed as possibly absent **on purpose**. They are not
 * validated at the boundary (see `validate.ts`), and a live API omits fields it
 * promised and adds enum values it did not. Declaring them required would let
 * TypeScript vouch for data nobody checked, and the resulting `undefined` would be
 * discovered as a wrong balance rather than a type error.
 *
 * Read them through the accessors in `money.ts` — {@link signedAmount},
 * {@link transactionDate}, {@link isHold} — which return `null` rather than a guess.
 */
export interface Transaction {
  /** Stable primary key; used for de-duplication. */
  id: string;
  cardId?: string | null;
  type?: TransactionType | null;
  /**
   * `DEBIT` (money out) or `CREDIT` (money in) — but treat any other value as
   * *unknown*, not as a debit. Use {@link directionSign}.
   */
  direction?: TransactionDirection | null;
  settlementCurrency?: string | null;
  settlementAmount?: MoneyString | null;
  transactionCurrency?: string | null;
  transactionAmount?: MoneyString | null;
  providerTransactionId?: string | null;
  /** Solana signature for on-chain legs (deposits/withdrawals). */
  onchainSignature?: string | null;
  transactionTimestamp?: string | null;
  /** Present for card purchases. */
  card?: TransactionCard | null;
  deposit?: unknown | null;
  withdrawal?: unknown | null;
  qr?: unknown | null;
}

export interface PageMeta {
  page?: number | null;
  limit?: number | null;
  total?: number | null;
  /** Absent on some responses — pagination must not depend on it alone. */
  totalPages?: number | null;
}

export interface Paginated<T> {
  /** Structurally guaranteed to be an array (see `validate.ts`). */
  data: T[];
  meta?: PageMeta | null;
}

export interface TransactionCategoriesResponse {
  data: TransactionCategory[];
}

// ─── Insights ────────────────────────────────────────────────────────────────

export interface SpendSummaryBucket {
  /** ISO date, e.g. "2026-07-01". */
  date: string;
  amount: MoneyString;
}

export interface SpendSummary {
  currency: string;
  /** IANA timezone, e.g. "America/New_York". */
  timezone: string;
  granularity: string;
  total: MoneyString;
  startAt: string;
  endAt: string;
  /** Percentage change vs the previous period. */
  deltaPercent: number;
  breakdown: SpendSummaryBucket[];
}

export interface GlobalSpendCountry {
  /** ISO alpha-2. */
  code: string;
  numeric: string;
  currency: string;
  spendAmount: MoneyString;
}

export interface GlobalSpend {
  currency: string;
  totalSpendAmount: MoneyString;
  countryCount: number;
  countries: GlobalSpendCountry[];
}

export interface GlobalSpendBreakdownRow {
  /** Time bucket key. */
  bucket: string;
  country: {
    alpha2: string;
    alpha3: string;
    numeric: string;
    name: string;
  };
  settlementAmount: MoneyString;
  settlementCurrency: string;
  transactionAmount: MoneyString;
  transactionCurrency: string;
}

export interface GlobalSpendBreakdown {
  granularity: string;
  settlementCurrency: string;
  totalSettlementAmount: MoneyString;
  countryCount: number;
  data: GlobalSpendBreakdownRow[];
  meta: PageMeta;
}

export interface CategorySpend {
  id: string;
  name: string;
  icon: string;
  amount: MoneyString;
  /** 0–100. */
  percentage: number;
}

export interface SpendingByCategory {
  currency: string;
  totalAmount: MoneyString;
  categories: CategorySpend[];
}

export interface MerchantSpend {
  merchantName: string;
  merchantLogoUrl: string;
  transactionCount: number;
  totalSpent: MoneyString;
}

export interface TopMerchants {
  currency: string;
  merchants: MerchantSpend[];
}

// ─── Referral ────────────────────────────────────────────────────────────────

export interface ReferralQualification {
  referredUserSpendCentsRequired?: number;
  spendCentsRequired?: number;
  windowDays: number;
}

export interface ReferralTier {
  rewardAmountCents: number;
  qualification: ReferralQualification;
}

export interface ReferralProgram {
  referrer: ReferralTier;
  referee: ReferralTier;
}

export interface ReferralInfo {
  referralProgram: ReferralProgram;
  referralInfo: {
    header: { title: string; subtitle: string };
    sections: Array<{
      type: string;
      title: string;
      steps: Array<{
        id: string;
        indicator: { type: string; value: number };
        title: string;
        description: string;
      }>;
    }>;
  };
}

export interface ReferralSummary {
  total: number;
  pending: number;
  qualified: number;
  totalReferralEarnCents: number;
  referralProgram: ReferralProgram;
}

// ─── Shared ──────────────────────────────────────────────────────────────────

/** An inclusive ISO-8601 date range used by the insight endpoints. */
export interface DateRange {
  /** ISO 8601, inclusive start. */
  from: string;
  /** ISO 8601, inclusive end. */
  to: string;
}
