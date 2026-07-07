/**
 * Email-OTP login (pure HTTP, no browser). First run prompts for the code
 * emailed to you; the session persists to `.jup-session.json` and refreshes
 * automatically, so later runs are non-interactive.
 *
 *   JUP_EMAIL=you@example.com npx tsx examples/login.ts
 */
import { createInterface } from "node:readline/promises";
import { JupiterCard } from "../src/index.js";

const email = process.env.JUP_EMAIL;
if (!email) {
  console.error("Set JUP_EMAIL to your Jupiter account email.");
  process.exit(1);
}

const jc = new JupiterCard({
  auth: { kind: "email", email, sessionFile: process.env.JUP_SESSION_FILE ?? ".jup-session.json" },
});

if (!jc.isAuthenticated()) {
  await jc.login.sendCode();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const code = (await rl.question(`Enter the code sent to ${email}: `)).trim();
  await rl.close();
  await jc.login.verify(code);
  console.log("logged in; session saved.");
} else {
  console.log("reusing saved session.");
}

const me = await jc.account.customer();
console.log(`customer: ${me.email} | ${me.countryOfResidence} | ${me.status}`);

console.log("balance:", await jc.cards.balance());
console.log("cashback:", await jc.cards.cashbackBalance());

console.log("\nrecent transactions:");
let n = 0;
for await (const tx of jc.transactions.iterate({ year: new Date().getUTCFullYear() })) {
  const merchant = tx.card?.merchantName ?? tx.type;
  console.log(` - ${tx.transactionTimestamp}  ${tx.direction.padEnd(6)} ${tx.settlementAmount} ${tx.settlementCurrency}  ${merchant}`);
  if (++n >= 10) break;
}

const now = new Date();
const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
console.log("\nmonth spend:", await jc.insights.spendSummary({ from, to: now.toISOString() }));
