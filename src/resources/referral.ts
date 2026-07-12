import type { HttpClient } from "../http.js";
import type { ReferralInfo, ReferralSummary } from "../types.js";
import { expectObject } from "../validate.js";

const INFO = "/api/proxy/referral/info";
const SUMMARY = "/api/proxy/referral/summary";

/** Referral program details and the customer's referral standing. */
export class Referral {
  constructor(private readonly http: HttpClient) {}

  /** Program terms + display copy. `GET /api/proxy/referral/info` */
  async info(): Promise<ReferralInfo> {
    const res = await this.http.get<unknown>(INFO);
    return expectObject(res, INFO, "a referral info object") as unknown as ReferralInfo;
  }

  /** The customer's referral counts and earnings. `GET /api/proxy/referral/summary` */
  async summary(): Promise<ReferralSummary> {
    const res = await this.http.get<unknown>(SUMMARY);
    return expectObject(res, SUMMARY, "a referral summary object") as unknown as ReferralSummary;
  }
}
