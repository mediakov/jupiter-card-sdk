/**
 * Sync every transaction for the year to a JSON file — a minimal "syncer".
 * Reuses the saved session (run examples/login.ts once first).
 *
 *   JUP_EMAIL=you@example.com npx tsx examples/sync-transactions.ts [year] [out.json]
 */
import { writeFileSync } from "node:fs";
import { JupiterCard, directionSign, isBookable } from "../src/index.js";

const email = process.env.JUP_EMAIL;
if (!email) {
  console.error("Set JUP_EMAIL (and run examples/login.ts once to establish the session).");
  process.exit(1);
}

const year = Number(process.argv[2]) || new Date().getUTCFullYear();
const out = process.argv[3] ?? `transactions-${year}.json`;

const jc = new JupiterCard({ auth: { kind: "email", email, sessionFile: ".jup-session.json" } });
if (!jc.isAuthenticated()) {
  console.error("No saved session. Run: JUP_EMAIL=… npx tsx examples/login.ts");
  process.exit(1);
}

console.log(`fetching ${year} transactions…`);
const txs = await jc.transactions.all({ year });
writeFileSync(out, JSON.stringify(txs, null, 2));

// Count with the accessors, not by hand. `directionSign` returns null for a direction
// the SDK does not know — those records are reported, not quietly filed as debits.
const debits = txs.filter((t) => directionSign(t) === -1).length;
const credits = txs.filter((t) => directionSign(t) === 1).length;
const unreadable = txs.filter((t) => !isBookable(t));

console.log(`wrote ${txs.length} transactions (${debits} debits, ${credits} credits) to ${out}`);
if (unreadable.length > 0) {
  console.warn(`⚠️  ${unreadable.length} could not be read (unknown direction, or a bad amount/date):`);
  for (const tx of unreadable.slice(0, 5)) console.warn(`     ${tx.id}  direction=${tx.direction ?? "—"} amount=${tx.settlementAmount ?? "—"}`);
}
