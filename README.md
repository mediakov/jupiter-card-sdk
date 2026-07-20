# jupiter-card-sdk

[![CI](https://github.com/mediakov/jupiter-card-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/mediakov/jupiter-card-sdk/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/jupiter-card-sdk.svg)](https://www.npmjs.com/package/jupiter-card-sdk)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Unofficial, fully-typed TypeScript SDK for the **Jupiter Card** account API
(jup.ag / **Jupiter Global**). Log in with your email, then read your cards,
balances, transactions, and spend insights.

- 🔐 **Email OTP auth** with automatic token refresh and persisted sessions
- 🧾 **Typed** models for every response (derived from live introspection)
- ♻️ Retries with backoff, timeouts, and a typed error hierarchy
- 📦 **Dual ESM + CJS**, zero-config, one runtime dependency
- 🧪 Tested (mocked HTTP), no browser or Privy SDK required

> **Unofficial & personal-use.** Not affiliated with or endorsed by Jupiter. It
> talks to a private API that can change without notice. Use it only with your
> own account and within Jupiter's terms.

## Install

```bash
npm install jupiter-card-sdk
```

Requires Node ≥ 20 (uses the built-in `fetch`).

## Quick start

```ts
import { JupiterCard, signedAmount, transactionDate } from "jupiter-card-sdk";

const jc = new JupiterCard({
  auth: { kind: "email", email: "you@example.com", sessionFile: ".jup-session.json" },
});

// First run only — a code is emailed to you:
if (!jc.isAuthenticated()) {
  await jc.login.sendCode();
  await jc.login.verify("123456"); // the code from your inbox
}

const balance = await jc.cards.balance();
console.log(balance); // { currency: "USD", spendableBalance: 123.45, withdrawableBalance: 123.45 }

// Everything at or after a date — handles the year filter and pagination for you.
for await (const tx of jc.transactions.since(new Date("2026-01-01"))) {
  console.log(transactionDate(tx), signedAmount(tx), tx.card?.merchantName);
}
```

## Reading money

**Do not compute the sign yourself.** The obvious one-liner is wrong:

```ts
const sum = (tx.direction === "CREDIT" ? 1 : -1) * Number(tx.settlementAmount); // ✗
```

It treats everything that is *not* `CREDIT` as money leaving the account — so a missing
`direction`, or a value Jupiter adds later, books income as an expense. And `Number("")`
is `0`, so a malformed amount silently becomes a real, wrong number.

Use the accessors. Each returns `null` for a record it cannot read honestly — `null`
means *"this cannot be represented"*, never zero:

```ts
import { signedAmount, transactionDate, isDeclined, isHold, isBookable } from "jupiter-card-sdk";

signedAmount(tx);    // -10.5 for a debit, +10.5 for a credit, null if unknown
transactionDate(tx); // a Date, or null — never an Invalid Date
isDeclined(tx);      // true for a refused charge (e.g. INSUFFICIENT_FUNDS) — no money moved
isHold(tx);          // a card authorisation still pending settlement (never a decline)
isBookable(tx);      // false → skip it rather than write a guess, or an expense that never happened
```

A decline (`card.status` like `INSUFFICIENT_FUNDS`) carries a full amount and a valid date,
so `isDeclined` — not the numbers — is the only signal no money moved. `isHold` and
`isBookable` both account for it: a decline is neither a hold nor bookable.

The money-bearing fields on `Transaction` are typed as possibly absent **on purpose**:
they are not validated, and a live API omits fields it promised. Declaring them required
would make TypeScript vouch for data nobody checked.

What *is* checked is the response's **structure** — if an endpoint that promises a list
returns something else (a Cloudflare challenge page, say), the SDK throws a
`ValidationError` rather than handing back a value that only claims to be a list.

After the first login the session is saved to `sessionFile` and refreshed
automatically, so subsequent runs need no code entry (for the ~7-day refresh
window). **Treat `sessionFile` like a password** — it holds your tokens.

## Authentication

The card API is gated by a session cookie + an `x-auth-flow: legacy` header.
The SDK handles the full email flow over Jupiter's own endpoints (no Privy SDK,
no browser):

```
sendCode  → POST /api/proxy/auth/email/send-code   { email }
verify    → POST /api/proxy/auth/email/verify-code  { email, code, type: "LOGIN" }  → tokens
refresh   → POST /api/auth/refresh                  (automatic on 401)
```

### Auth modes

```ts
// Email OTP (recommended): persists + auto-refreshes
new JupiterCard({ auth: { kind: "email", email, sessionFile: ".jup-session.json" } });

// Bring your own cookie string (e.g. for a quick script)
new JupiterCard({ auth: { kind: "cookie", cookie: "access_token=…; refresh_token=…" } });
```

## API

All amounts are **decimal strings** (e.g. `"123.45"`) to preserve precision —
except `cards.balance()`, which returns numbers.

### `cards`
| Method | Returns |
|---|---|
| `cards.list()` | `Card[]` |
| `cards.balance()` | `{ currency, spendableBalance, withdrawableBalance }` |
| `cards.cashbackBalance()` | `{ currency, balance }` |

### `transactions`
| Method | Returns |
|---|---|
| `transactions.list({ page?, limit?, year? })` | `Paginated<Transaction>` |
| `transactions.get(id)` | `Transaction` (with merchant, category, fees) |
| `transactions.categories()` | `TransactionCategory[]` |
| `transactions.iterate({ year? })` | `AsyncGenerator<Transaction>` (auto-paginates) |
| `transactions.all({ year? })` | `Transaction[]` |

### `insights` (each takes `{ from, to }` ISO timestamps)
`spendSummary` · `spendingByCategory` · `topMerchants` · `globalSpend` ·
`globalSpendBreakdown(range, page?, limit?)`

### `account`
`customer()` · `countries()` · `unsignedTerms()`

### `referral`
`info()` · `summary()`

## Errors

Every failed request throws a subclass of `JupiterError`:

```ts
import { AuthError, RateLimitError, ApiError, TimeoutError } from "jupiter-card-sdk";

try {
  await jc.cards.balance();
} catch (e) {
  if (e instanceof AuthError) { /* session invalid — re-login */ }
  else if (e instanceof RateLimitError) { /* e.retryAfterMs */ }
  else if (e instanceof ApiError) { /* e.status, e.code, e.body */ }
  else if (e instanceof TimeoutError) { /* slow network */ }
}
```

`429` and `5xx` are retried automatically with exponential backoff (configurable
via `maxRetries` / `timeoutMs` on the constructor).

## Configuration

```ts
new JupiterCard({
  auth: { kind: "email", email },
  timeoutMs: 30_000,   // per-request timeout
  maxRetries: 3,       // 429/5xx/network retries
  baseUrl: "https://global.jup.ag",
  fetch: customFetch,  // inject your own fetch (proxy, instrumentation, tests)
});
```

## Examples

```bash
JUP_EMAIL=you@example.com npx tsx examples/login.ts             # interactive login + overview
JUP_EMAIL=you@example.com npx tsx examples/sync-transactions.ts 2026 out.json
```

## Development

```bash
npm install
npm run typecheck
npm test         # vitest, mocked HTTP
npm run build    # tsup → dual ESM/CJS + .d.ts
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [SECURITY.md](./SECURITY.md).

## License

MIT
