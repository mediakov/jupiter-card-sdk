# Contributing

Thanks for helping improve jupiter-card-sdk!

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest (mocked HTTP, no live calls)
npm run build       # tsup → dual ESM/CJS + .d.ts
```

- Source is TypeScript in `src/`. Tests are in `test/` and must **not** make
  live network calls — inject the mock fetch from `test/helpers.ts`.
- Every public method gets JSDoc. Keep response types in `src/types.ts` in sync
  with the real API.

## Commit messages

This repo uses [Conventional Commits](https://www.conventionalcommits.org/) and
[semantic-release](https://semantic-release.gitbook.io/): the commit history
decides the next version, changelog, and npm publish. Examples:

- `feat: add cards.freeze()` → minor
- `fix(http): retry on ECONNRESET` → patch
- `feat!: rename JupiterCard.login.verify` (or a `BREAKING CHANGE:` footer) → major

## Adding an endpoint

1. Add/extend the response type in `src/types.ts`.
2. Add the method to the relevant resource in `src/resources/`, with JSDoc and
   the exact path in the doc comment.
3. Add a test in `test/resources.test.ts` using a mocked response.
4. If it's a new resource, wire it into `src/client.ts` and export from
   `src/index.ts`.

## Security & privacy

Never commit access tokens, refresh tokens, cookies, or personal account data —
including in tests, fixtures, or issue reports. Redact `access_token` /
`refresh_token` values everywhere.

## Reverse-engineering note

This is an **unofficial** SDK for a private API that can change without notice.
When the API shifts, update the types from a fresh observation and bump
accordingly. See [SECURITY.md](./SECURITY.md).
