import type { HttpClient } from "../http.js";
import type { Country, Customer } from "../types.js";

/** Customer profile and account-level reference data. */
export class Account {
  constructor(private readonly http: HttpClient) {}

  /** The authenticated customer's profile. `GET /api/proxy/customer` */
  customer(): Promise<Customer> {
    return this.http.get<Customer>("/api/proxy/customer");
  }

  /** Countries supported by the card application. `GET /api/proxy/customer/application/countries` */
  countries(): Promise<Country[]> {
    return this.http.get<Country[]>("/api/proxy/customer/application/countries");
  }

  /**
   * Terms & conditions the customer has not yet signed (usually empty).
   * `GET /api/proxy/customer/tnc/unsigned`
   */
  unsignedTerms(): Promise<unknown[]> {
    return this.http.get<unknown[]>("/api/proxy/customer/tnc/unsigned");
  }
}
