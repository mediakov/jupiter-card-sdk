import type { HttpClient } from "../http.js";
import type { Card, CardBalance, CashbackBalance } from "../types.js";
import { expectArrayAt, expectObject } from "../validate.js";

/** Cards, spendable balance, and cashback. */
export class Cards {
  constructor(private readonly http: HttpClient) {}

  /** List the customer's cards. `GET /api/proxy/cards` */
  async list(): Promise<Card[]> {
    const res = await this.http.get<unknown>("/api/proxy/cards");
    return expectArrayAt<Card>(res, "cards", "/api/proxy/cards", "a cards object");
  }

  /**
   * Spendable / withdrawable balance.
   * `GET /api/proxy/cards/balance` — note amounts here are **numbers**.
   *
   * The amounts are optional on {@link CardBalance}: an absent balance is unknown,
   * not zero, and writing a zero into a ledger states a fact the API never gave us.
   */
  async balance(): Promise<CardBalance> {
    const res = await this.http.get<unknown>("/api/proxy/cards/balance");
    return expectObject(res, "/api/proxy/cards/balance", "a balance object") as CardBalance;
  }

  /** Cashback balance (amount is a decimal string). `GET /api/proxy/cashback/balance` */
  async cashbackBalance(): Promise<CashbackBalance> {
    const res = await this.http.get<unknown>("/api/proxy/cashback/balance");
    return expectObject(res, "/api/proxy/cashback/balance", "a cashback balance object") as unknown as CashbackBalance;
  }
}
