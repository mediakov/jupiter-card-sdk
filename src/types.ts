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
  customerId: string;
  /** Card issuer/provider. */
  provider: string;
  cardAccountId: string;
  status: CardStatus;
  /** Card art / design identifier. */
  design: string;
  imageUrl: string;
  last4: string;
  /** Two-digit month, e.g. "07". */
  expirationMonth: string;
  /** Four-digit year, e.g. "2028". */
  expirationYear: string;
  createdAt: string;
  updatedAt: string;
}

export interface CardsResponse {
  cards: Card[];
}

export interface CardBalance {
  /** e.g. "USD". */
  currency: string;
  /** NOTE: numbers here (not strings). */
  spendableBalance: number;
  withdrawableBalance: number;
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

/** Card-specific detail present on `type: "CARD"` transactions. */
export interface TransactionCard {
  last4: string;
  merchantName: string;
  merchantLogoUrl: string;
  /** ISO 18245 MCC. */
  merchantCategoryCode: string;
  /** Present on the single-transaction endpoint. */
  category?: TransactionCategory;
  /** Present on the single-transaction endpoint. */
  canApplyToSimilar?: boolean;
  /** User note, if set. */
  note?: string | null;
  status: string;
  settlementTimestamp: string | null;
  fees: TransactionFees;
}

export interface Transaction {
  id: string;
  cardId: string;
  type: TransactionType;
  direction: TransactionDirection;
  settlementCurrency: string;
  settlementAmount: MoneyString;
  transactionCurrency: string;
  transactionAmount: MoneyString;
  providerTransactionId: string;
  /** Solana signature for on-chain legs (deposits/withdrawals). */
  onchainSignature: string | null;
  transactionTimestamp: string;
  /** Present for card purchases. */
  card: TransactionCard | null;
  deposit: unknown | null;
  withdrawal: unknown | null;
  qr: unknown | null;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
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
