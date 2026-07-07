import type { HttpClient } from "../http.js";
import type { ReferralInfo, ReferralSummary } from "../types.js";

/** Referral program details and the customer's referral standing. */
export class Referral {
  constructor(private readonly http: HttpClient) {}

  /** Program terms + display copy. `GET /api/proxy/referral/info` */
  info(): Promise<ReferralInfo> {
    return this.http.get<ReferralInfo>("/api/proxy/referral/info");
  }

  /** The customer's referral counts and earnings. `GET /api/proxy/referral/summary` */
  summary(): Promise<ReferralSummary> {
    return this.http.get<ReferralSummary>("/api/proxy/referral/summary");
  }
}
