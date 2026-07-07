/**
 * Quick escape-hatch demo: hit the API with a pasted session cookie
 * (access_token=…; refresh_token=…). Good for a one-off (~15-min) run without
 * the OTP round-trip. For durable use, prefer examples/login.ts.
 *
 *   JUP_COOKIE='access_token=…; refresh_token=…; oauth_flow=…' npx tsx examples/cookie-auth.ts
 */
import { JupiterCard } from "../src/index.js";

const cookie = process.env.JUP_COOKIE;
if (!cookie) {
  console.error("Set JUP_COOKIE to a session cookie string.");
  process.exit(1);
}

const jc = new JupiterCard({ auth: { kind: "cookie", cookie } });

console.log("balance:", await jc.cards.balance());
console.log("cashback:", await jc.cards.cashbackBalance());

console.log("recent transactions:");
let n = 0;
for await (const tx of jc.transactions.iterate({ year: new Date().getUTCFullYear() })) {
  console.log(` - ${tx.id} ${tx.direction ?? ""} ${tx.settlementAmount ?? ""} ${tx.settlementCurrency ?? ""}`);
  if (++n >= 10) break;
}
