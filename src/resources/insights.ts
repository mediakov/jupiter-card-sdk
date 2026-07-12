import type { HttpClient } from "../http.js";
import type {
  DateRange,
  GlobalSpend,
  GlobalSpendBreakdown,
  SpendSummary,
  SpendingByCategory,
  TopMerchants,
} from "../types.js";
import { expectObject } from "../validate.js";

function range(r: DateRange): Record<string, string> {
  return { from: r.from, to: r.to };
}

/** Pre-aggregated spend analytics over an ISO date range. */
export class Insights {
  constructor(private readonly http: HttpClient) {}

  /** Every insight endpoint answers a JSON object; anything else is not an insight. */
  private async getObject<T>(path: string, query: Record<string, string | number>, what: string): Promise<T> {
    const res = await this.http.get<unknown>(path, query);
    return expectObject(res, path, what) as unknown as T;
  }

  /** Total spend + per-day breakdown + delta vs previous period. */
  spendSummary(r: DateRange): Promise<SpendSummary> {
    return this.getObject("/api/proxy/insight/spend-summary", range(r), "a spend summary object");
  }

  /** Spend grouped by category. */
  spendingByCategory(r: DateRange): Promise<SpendingByCategory> {
    return this.getObject("/api/proxy/insight/spending-by-category", range(r), "a spending-by-category object");
  }

  /** Top merchants by spend. */
  topMerchants(r: DateRange): Promise<TopMerchants> {
    return this.getObject("/api/proxy/insight/top-merchants", range(r), "a top-merchants object");
  }

  /** Spend grouped by country. */
  globalSpend(r: DateRange): Promise<GlobalSpend> {
    return this.getObject("/api/proxy/insight/global-spend", range(r), "a global-spend object");
  }

  /** Paginated per-country / per-bucket spend breakdown. */
  globalSpendBreakdown(r: DateRange, page = 1, limit = 20): Promise<GlobalSpendBreakdown> {
    return this.getObject(
      "/api/proxy/insight/global-spend-breakdown",
      { ...range(r), page, limit },
      "a global-spend-breakdown object",
    );
  }
}
