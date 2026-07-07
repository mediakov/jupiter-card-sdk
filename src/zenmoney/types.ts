/**
 * ZenMoney **plugin** data model (the `movements` format that a ZenPlugins
 * `scrape()` returns). This is distinct from the ZenMoney backend `/v8/diff`
 * format — see `../../../zenmoney-syncer` for the movements→diff adapter.
 *
 * Refs:
 *  - https://github.com/zenmoney/ZenPlugins/blob/master/docs/README.md
 *  - https://github.com/zenmoney/ZenPlugins/blob/master/docs/transactionsExamples.md
 */

export type AccountType = "ccard" | "checking" | "card" | "cash" | "loan" | "deposit" | "debt" | "emoney";

export interface ZenAccount {
  /** Stable unique id; movements reference it via `account.id`. */
  id: string;
  type: AccountType;
  title: string;
  /** Currency code, e.g. "USD". */
  instrument: string;
  /** Current balance. */
  balance?: number;
  /** Available-to-spend, if distinct from balance. */
  available?: number;
  creditLimit?: number;
  /** Card numbers / external ids used to match transfers, e.g. ["1234"]. */
  syncIds: string[] | null;
  savings?: boolean;
}

/** Amount in the transaction's original currency, when it differs from the account currency. */
export interface ZenInvoice {
  /** Signed original amount (negative = outflow). */
  sum: number;
  /** Original currency code. */
  instrument: string;
}

/** A reference to an account not owned by this plugin (e.g. the counterparty of a transfer). */
export interface ZenAccountReference {
  type: AccountType | null;
  instrument: string;
  company?: null;
  syncIds: string[];
}

export interface ZenMovement {
  /** Bank's own id for this leg (used for de-duplication); null if none. */
  id: string | null;
  /** Either an owned account `{ id }` or a reference to an external one. */
  account: { id: string } | ZenAccountReference;
  /** Original-currency amount, or null when same as account currency. */
  invoice: ZenInvoice | null;
  /** Signed amount in the account currency (negative = outflow); null if unknown. */
  sum: number | null;
  /** Signed fee in the account currency. */
  fee: number | null;
}

export interface ZenMerchant {
  /** Full unparsed merchant string. Use this OR the structured title/city/country. */
  fullTitle?: string;
  title?: string;
  city?: string | null;
  country?: string | null;
  /** ISO 18245 merchant category code. */
  mcc: number | null;
  location?: { latitude: number; longitude: number } | null;
}

export interface ZenTransaction {
  /** Optional stable id (dedup); we set it to the Jupiter transaction id. */
  id?: string;
  date: Date;
  /** true = authorization hold (pending), false = posted, null = unknown. */
  hold: boolean | null;
  merchant: ZenMerchant | null;
  /** One movement for a normal spend; two for an internal transfer. */
  movements: [ZenMovement] | [ZenMovement, ZenMovement];
  comment: string | null;
}

/** What a plugin's `scrape()` resolves to. */
export interface ScrapeResult {
  accounts: ZenAccount[];
  transactions: ZenTransaction[];
}
