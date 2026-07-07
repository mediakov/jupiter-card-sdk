import type { HttpClient } from "../http.js";
import type { Card, CardsResponse, CardBalance, CashbackBalance } from "../types.js";

/** Cards, spendable balance, and cashback. */
export class Cards {
  constructor(private readonly http: HttpClient) {}

  /** List the customer's cards. `GET /api/proxy/cards` */
  async list(): Promise<Card[]> {
    const res = await this.http.get<CardsResponse>("/api/proxy/cards");
    return res.cards;
  }

  /**
   * Spendable / withdrawable balance.
   * `GET /api/proxy/cards/balance` — note amounts here are **numbers**.
   */
  balance(): Promise<CardBalance> {
    return this.http.get<CardBalance>("/api/proxy/cards/balance");
  }

  /** Cashback balance (amount is a decimal string). `GET /api/proxy/cashback/balance` */
  cashbackBalance(): Promise<CashbackBalance> {
    return this.http.get<CashbackBalance>("/api/proxy/cashback/balance");
  }
}
