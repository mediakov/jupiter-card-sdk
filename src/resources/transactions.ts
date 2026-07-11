import { CARD_LAUNCH_YEAR, DEFAULTS } from "../constants.js";
import type { HttpClient } from "../http.js";
import { transactionDate } from "../money.js";
import type { Paginated, Transaction, TransactionCategory } from "../types.js";
import { expectArrayAt, expectObject, isRecord } from "../validate.js";

const PATH = "/api/proxy/transactions";

export interface TransactionListParams {
  /** 1-based page number. */
  page?: number;
  /** Page size (default 20). */
  limit?: number;
  /** Filter to a calendar year, e.g. 2026. */
  year?: number;
}

export interface TransactionSinceParams {
  /** Page size to request while walking. */
  limit?: number;
}

/**
 * The first year to query when crawling back to `from`.
 *
 * Deliberately starts a year *early*. Jupiter's `year` filter does not appear to
 * bucket on UTC midnight, so a transaction in the opening hours of a year can be
 * filed under the previous one; asking only for `from`'s year would drop it. The
 * surplus is discarded by the timestamp comparison, so the cost is one extra request
 * and the benefit is not silently losing a transaction.
 *
 * Exported for testing.
 */
export function firstYearToQuery(from: Date, thisYear: number): number {
  return Math.min(Math.max(from.getUTCFullYear() - 1, CARD_LAUNCH_YEAR), thisYear);
}

/** Card transactions: paginated list, single fetch, categories, and iteration. */
export class Transactions {
  constructor(private readonly http: HttpClient) {}

  /** One page of transactions. `GET /api/proxy/transactions` */
  async list(params: TransactionListParams = {}): Promise<Paginated<Transaction>> {
    const res = await this.http.get<unknown>(PATH, {
      page: params.page,
      limit: params.limit,
      year: params.year,
    });
    const data = expectArrayAt<Transaction>(res, "data", PATH, "a paginated transactions object");
    const meta = isRecord(res) && isRecord(res.meta) ? res.meta : undefined;
    return { data, meta: meta as Paginated<Transaction>["meta"] };
  }

  /** A single transaction with full detail. `GET /api/proxy/transactions/{id}` */
  async get(id: string): Promise<Transaction> {
    const path = `${PATH}/${encodeURIComponent(id)}`;
    const res = await this.http.get<unknown>(path);
    return expectObject(res, path, "a transaction object") as unknown as Transaction;
  }

  /** Spend categories used to classify transactions. `GET /api/proxy/transactions/categories` */
  async categories(): Promise<TransactionCategory[]> {
    const path = `${PATH}/categories`;
    const res = await this.http.get<unknown>(path);
    return expectArrayAt<TransactionCategory>(res, "data", path, "a categories object");
  }

  /**
   * Async-iterate every transaction (optionally within a year), following pagination.
   *
   * Yields each transaction **at most once**. Page-based paging is racy: a transaction
   * arriving mid-crawl shifts the later pages down, so a record on a page boundary is
   * served twice — which, uncorrected, double-counts it in whatever you are building.
   *
   * ```ts
   * for await (const tx of client.transactions.iterate({ year: 2026 })) {
   *   console.log(tx.id, signedAmount(tx));
   * }
   * ```
   */
  async *iterate(params: TransactionListParams = {}): AsyncGenerator<Transaction> {
    const limit = params.limit ?? 20;
    let page = params.page ?? 1;
    const seen = new Set<string>();

    for (let walked = 0; walked < DEFAULTS.maxPages; walked++) {
      const res = await this.list({ ...params, page, limit });
      const rows = res.data;

      for (const tx of rows) {
        if (tx.id != null && tx.id !== "") {
          if (seen.has(tx.id)) continue;
          seen.add(tx.id);
        }
        yield tx;
      }

      if (rows.length === 0) break;
      const totalPages = res.meta?.totalPages;
      if (totalPages != null) {
        if (page >= totalPages) break;
      } else if (rows.length < limit) {
        break;
      }
      page += 1;
    }
  }

  /** Collect all transactions (optionally within a year) into an array. */
  async all(params: TransactionListParams = {}): Promise<Transaction[]> {
    const out: Transaction[] = [];
    for await (const tx of this.iterate(params)) out.push(tx);
    return out;
  }

  /**
   * Every transaction at or after `from`, de-duplicated.
   *
   * Prefer this over driving `year` by hand: it starts a year early to survive the
   * year-boundary bucketing (see {@link firstYearToQuery}) and stops at the card's
   * launch year, so a caller cannot silently miss history at either end.
   *
   * **The API does not guarantee an ordering**, so every page of every year in range is
   * walked and each record is compared to `from` individually. Ending the crawl at the
   * first page that finishes before `from` would be much cheaper — and would silently
   * truncate the history behind a single out-of-order row. Do not add that shortcut.
   * For the same reason, the yield order is unspecified: sort if you need one.
   *
   * Records whose timestamp is unreadable are yielded rather than dropped — the SDK
   * does not decide what is worth keeping. Filter with `isBookable` if you need to.
   */
  async *since(from: Date, params: TransactionSinceParams = {}): AsyncGenerator<Transaction> {
    if (Number.isNaN(from.getTime())) {
      throw new RangeError("since(from): `from` is not a valid Date");
    }
    const thisYear = new Date().getUTCFullYear();
    const seen = new Set<string>();

    for (let year = firstYearToQuery(from, thisYear); year <= thisYear; year++) {
      for await (const tx of this.iterate({ ...params, year })) {
        if (tx.id != null && tx.id !== "") {
          if (seen.has(tx.id)) continue;
          seen.add(tx.id);
        }
        const at = transactionDate(tx);
        // An unreadable timestamp cannot be compared to `from`. Dropping it here would
        // hide the record entirely; the caller can see it and decide.
        if (at != null && at < from) continue;
        yield tx;
      }
    }
  }
}
