# [0.3.0](https://github.com/mediakov/jupiter-card-sdk/compare/v0.2.1...v0.3.0) (2026-07-20)


### Features

* add isDeclined, and stop treating declines as holds/bookable ([214540c](https://github.com/mediakov/jupiter-card-sdk/commit/214540cebce1782333dfff52c5cb39a4393136bd))


### BREAKING CHANGES

* isHold and isBookable now return false for a declined
card transaction where they previously returned true. This is the point
— but code relying on the old behaviour will see the change. In 0.x this
is a minor bump.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

## [0.2.1](https://github.com/mediakov/jupiter-card-sdk/compare/v0.2.0...v0.2.1) (2026-07-12)


### Bug Fixes

* validate the insights, account and referral responses too ([31df0b2](https://github.com/mediakov/jupiter-card-sdk/commit/31df0b2bd9961fd5ccac1e0275f96aaf6df23662))

# [0.2.0](https://github.com/mediakov/jupiter-card-sdk/compare/v0.1.0...v0.2.0) (2026-07-11)


### Bug Fixes

* do not lose or double-count transactions while paging ([7ab2aa1](https://github.com/mediakov/jupiter-card-sdk/commit/7ab2aa138c0574edb000933021a03d6b20b037e1))
* never replay a request whose effect we cannot see ([552b817](https://github.com/mediakov/jupiter-card-sdk/commit/552b8174a57b2f79d53d9995ce87e918115c3586))


### Features

* read money through accessors instead of raw fields ([4fff88c](https://github.com/mediakov/jupiter-card-sdk/commit/4fff88cd6c8439730e652a6225e7518d3868db15))


### BREAKING CHANGES

* POST, PATCH and other non-idempotent requests are no longer
retried by default. Pass { retry: true } to restore the old behaviour for a
request you know is safe to repeat.
* Transaction.direction, settlementAmount, transactionTimestamp,
card and most fields on Card, CardBalance and PageMeta are now optional/nullable.
Read them with the new accessors from "jupiter-card-sdk". Endpoints that return
an unexpected shape now throw ValidationError rather than returning it.

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
