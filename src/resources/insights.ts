import type { HttpClient } from "../http.js";
import type {
  DateRange,
  GlobalSpend,
  GlobalSpendBreakdown,
  SpendSummary,
  SpendingByCategory,
  TopMerchants,
} from "../types.js";

function range(r: DateRange): Record<string, string> {
  return { from: r.from, to: r.to };
}

/** Pre-aggregated spend analytics over an ISO date range. */
export class Insights {
  constructor(private readonly http: HttpClient) {}

  /** Total spend + per-day breakdown + delta vs previous period. */
  spendSummary(r: DateRange): Promise<SpendSummary> {
    return this.http.get<SpendSummary>("/api/proxy/insight/spend-summary", range(r));
  }

  /** Spend grouped by category. */
  spendingByCategory(r: DateRange): Promise<SpendingByCategory> {
    return this.http.get<SpendingByCategory>("/api/proxy/insight/spending-by-category", range(r));
  }

  /** Top merchants by spend. */
  topMerchants(r: DateRange): Promise<TopMerchants> {
    return this.http.get<TopMerchants>("/api/proxy/insight/top-merchants", range(r));
  }

  /** Spend grouped by country. */
  globalSpend(r: DateRange): Promise<GlobalSpend> {
    return this.http.get<GlobalSpend>("/api/proxy/insight/global-spend", range(r));
  }

  /** Paginated per-country / per-bucket spend breakdown. */
  globalSpendBreakdown(r: DateRange, page = 1, limit = 20): Promise<GlobalSpendBreakdown> {
    return this.http.get<GlobalSpendBreakdown>("/api/proxy/insight/global-spend-breakdown", {
      ...range(r),
      page,
      limit,
    });
  }
}
