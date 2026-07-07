# Security Policy

## Reporting a vulnerability

Please report security issues **privately** via GitHub Security Advisories
("Report a vulnerability" on the Security tab) rather than opening a public
issue. We'll respond as quickly as we can.

## Handling credentials

- The session file (`.jup-session.json` by default) contains `access_token` and
  `refresh_token` cookies — treat it like a password. It is created with `0600`
  permissions and is gitignored. Do not commit or share it.
- Never paste tokens or cookies into issues, PRs, logs, or test fixtures.

## Scope & disclaimer

This is an **unofficial** SDK. It talks to Jupiter's private account API, is not
endorsed by Jupiter, and may break when that API changes. Use it only with your
own account and in accordance with Jupiter's terms of service.
