# Dependency security — 6 October 2026

The locked production dependency graph passes `npm audit --omit=dev --audit-level=high` with **zero reported vulnerabilities** at review time. This is a point-in-time advisory check, not a guarantee that every dependency is safe. Re-run it for each release; CI blocks new high/critical production advisories.

## Scoped security updates

| Consumer | Change | Compatibility evidence |
| --- | --- | --- |
| Next image processing | Sharp 0.35.4 → 0.35.5 through the existing supported dependency range | Clean install and production build; resolves the bundled librsvg finding |
| `@prisma/config` | Override `deepmerge-ts` to 8.0.2 | Actual Prisma config-loader unit test, client generation, clean migrations, upgrade migration, and database regression |
| ExcelJS | Override `uuid` to 11.1.1 | ExcelJS retains its CommonJS `v4` import; actual XLSX write/read unit test plus parsed browser exports before/after results release |

The overrides in `package.json` are limited to the affected consumers. Do not broaden them globally or run `npm audit fix --force`, which proposed unrelated downgrades during this review. Prisma and ExcelJS versions remain on their existing lines. Dependabot should keep the parent packages current; remove each override once its parent uses a patched version, then repeat the compatibility checks.

DeepmergeTS v8 changes collection merging and some types. The installed Prisma config loader uses its plain-object `deepmerge` function, and the regression exercises that real loader. UUID 11.1.1 retains CommonJS support and the `v4` export used by ExcelJS. These checks support the app's current usage; they do not claim compatibility with every API in either library.

Primary references: [DeepmergeTS advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), [DeepmergeTS v8 changes](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0), [UUID advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq), [UUID 11.1.1 release](https://github.com/uuidjs/uuid/releases/tag/v11.1.1), [librsvg advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w).

## Remaining development-tooling advisory

Full `npm audit` reports five high-severity package findings propagated from **one unpatched advisory** in `braces` 3.0.3: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The dependency path is `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`. At review time the advisory lists no patched release.

This path is development lint tooling, excluded from the production audit by `--omit=dev`; it is not a production-audit exception. Its glob patterns must remain trusted repository configuration, not user-supplied input. CI jobs have timeouts and read-only repository permissions. Those controls bound exposure; they do not patch the vulnerable parser. The maintainer must monitor the advisory/parent updates and rerun the full audit weekly. Investigate immediately if this package enters a runtime path or starts processing untrusted patterns.

## Verification commands

```bash
npm ci
npm ls sharp deepmerge-ts uuid braces
npm audit --omit=dev --audit-level=high
npm audit                     # expected development finding until upstream patch
npm run check
npm run db:migrate:test        # disposable DB settings required
npm run test:integration
npm run test:e2e
npm run test:e2e:production
```

Never paste access tokens, private registry credentials, real-user exports, or session traces into public advisory reports.
