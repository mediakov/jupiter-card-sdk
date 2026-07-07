# Changelog

All notable changes are documented here. This file is maintained automatically
by [semantic-release](https://semantic-release.gitbook.io/) from Conventional
Commit messages once releases are enabled.

## 0.1.0 (unreleased)

Initial release.

- Email one-time-code authentication with automatic token refresh and persisted
  sessions.
- Resources: `cards`, `transactions` (list, get, categories, `iterate`, `all`),
  `insights` (spend summary, by-category, top merchants, global spend +
  breakdown), `account` (customer, countries, unsigned terms), `referral`
  (info, summary).
- Typed error hierarchy (`AuthError`, `RateLimitError`, `ApiError`,
  `NetworkError`, `TimeoutError`) with automatic retry/backoff.
- Dual ESM + CJS build with full type declarations.
