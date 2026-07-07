/**
 * ZenMoney interop: types for the plugin `movements` format and pure converters
 * from Jupiter Card data. Dependency-free, so it also runs inside the ZenMoney
 * plugin sandbox.
 *
 *   import { toScrapeResult } from "jupiter-card-sdk/zenmoney";
 */
export * from "./types.js";
export { toZenAccount, toZenTransaction, toScrapeResult, accountIdFor } from "./convert.js";
