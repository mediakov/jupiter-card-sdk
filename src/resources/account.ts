import type { HttpClient } from "../http.js";
import type { Country, Customer } from "../types.js";
import { expectArray, expectObject } from "../validate.js";

const CUSTOMER = "/api/proxy/customer";
const COUNTRIES = "/api/proxy/customer/application/countries";
const UNSIGNED_TERMS = "/api/proxy/customer/tnc/unsigned";

/** Customer profile and account-level reference data. */
export class Account {
  constructor(private readonly http: HttpClient) {}

  /** The authenticated customer's profile. `GET /api/proxy/customer` */
  async customer(): Promise<Customer> {
    const res = await this.http.get<unknown>(CUSTOMER);
    return expectObject(res, CUSTOMER, "a customer object") as unknown as Customer;
  }

  /** Countries supported by the card application. `GET /api/proxy/customer/application/countries` */
  async countries(): Promise<Country[]> {
    const res = await this.http.get<unknown>(COUNTRIES);
    return expectArray<Country>(res, COUNTRIES, "an array of countries");
  }

  /**
   * Terms & conditions the customer has not yet signed (usually empty).
   * `GET /api/proxy/customer/tnc/unsigned`
   */
  async unsignedTerms(): Promise<unknown[]> {
    const res = await this.http.get<unknown>(UNSIGNED_TERMS);
    return expectArray<unknown>(res, UNSIGNED_TERMS, "an array of unsigned terms");
  }
}
