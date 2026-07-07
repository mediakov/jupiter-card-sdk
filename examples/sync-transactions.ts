/**
 * Sync every transaction for the year to a JSON file — a minimal "syncer".
 * Reuses the saved session (run examples/login.ts once first).
 *
 *   JUP_EMAIL=you@example.com npx tsx examples/sync-transactions.ts [year] [out.json]
 */
import { writeFileSync } from "node:fs";
import { JupiterCard } from "../src/index.js";

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

const debit = txs.filter((t) => t.direction === "DEBIT").length;
console.log(`wrote ${txs.length} transactions (${debit} debits) to ${out}`);
