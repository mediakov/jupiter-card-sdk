import type { HttpClient } from "../http.js";
import type { Paginated, Transaction, TransactionCategory, TransactionCategoriesResponse } from "../types.js";

export interface TransactionListParams {
  /** 1-based page number. */
  page?: number;
  /** Page size (default 20). */
  limit?: number;
  /** Filter to a calendar year, e.g. 2026. */
  year?: number;
}

/** Card transactions: paginated list, single fetch, categories, and iteration. */
export class Transactions {
  constructor(private readonly http: HttpClient) {}

  /** One page of transactions. `GET /api/proxy/transactions` */
  list(params: TransactionListParams = {}): Promise<Paginated<Transaction>> {
    return this.http.get<Paginated<Transaction>>("/api/proxy/transactions", {
      page: params.page,
      limit: params.limit,
      year: params.year,
    });
  }

  /** A single transaction with full detail. `GET /api/proxy/transactions/{id}` */
  get(id: string): Promise<Transaction> {
    return this.http.get<Transaction>(`/api/proxy/transactions/${encodeURIComponent(id)}`);
  }

  /** Spend categories used to classify transactions. `GET /api/proxy/transactions/categories` */
  async categories(): Promise<TransactionCategory[]> {
    const res = await this.http.get<TransactionCategoriesResponse>("/api/proxy/transactions/categories");
    return res.data;
  }

  /**
   * Async-iterate every transaction (optionally within a year), transparently
   * following pagination.
   *
   * ```ts
   * for await (const tx of client.transactions.iterate({ year: 2026 })) {
   *   console.log(tx.id, tx.direction, tx.settlementAmount);
   * }
   * ```
   */
  async *iterate(params: TransactionListParams = {}): AsyncGenerator<Transaction> {
    const limit = params.limit ?? 20;
    let page = params.page ?? 1;
    for (;;) {
      const res = await this.list({ ...params, page, limit });
      for (const tx of res.data) yield tx;
      const totalPages = res.meta?.totalPages;
      if (res.data.length === 0) break;
      if (totalPages != null) {
        if (page >= totalPages) break;
      } else if (res.data.length < limit) {
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
}
