# Regression testing

Use one suite in this repository. Agent-driven explorations should produce reproducible cases here when possible; they do not replace CI. The fixtures are synthetic and all writes stay in a disposable local database. Credentials supplied outside the repository must never be copied into tests.

## Automated test layers

| Layer | Command | Evidence |
| --- | --- | --- |
| Static and unit | `npm run check` | ESLint, generated Next route types, TypeScript, rules/formatting/security-policy tests |
| Database | `npm run test:integration` | Real PostgreSQL actions and constraints; auth identity, Next revalidation, and Sheets are mocked |
| Browser | `npm run test:e2e` | Production build, real Auth.js/Prisma, Chromium and WebKit, independent fixtures per test/retry |
| Hosted auth boundary | `npm run test:e2e:production` | Same build with hosted settings; direct credential callback rejection and existing session revocation |
| Dependency gate | `npm audit --omit=dev --audit-level=high` | Current production dependency advisory check; scoped fixes and development-tooling finding in [dependency-security.md](dependency-security.md) |
| Capacity baseline | `npm run test:load` | Bounded read requests only; see [capacity-testing.md](capacity-testing.md) |

`test:e2e:production` requires a build produced by `npm run build` or the main browser suite first. Never reuse a pre-existing web server: its environment could enable the wrong auth mode. The ordinary suite supports `E2E_SKIP_BUILD=1` only when code has not changed since the last build. CI builds from scratch. Both suites use one worker because fixtures share a database; CI browser matrix jobs each have their own PostgreSQL service.

## Local recipe

Use Node 22 and a disposable PostgreSQL 16 service. Example with Docker:

```bash
docker run --name onelegends-e2e \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=local-test-only \
  -e POSTGRES_DB=onelegends_e2e \
  -p 127.0.0.1:54329:5432 -d postgres:16

export DATABASE_URL=postgresql://postgres:local-test-only@127.0.0.1:54329/onelegends_e2e
export DIRECT_URL=$DATABASE_URL
export ALLOW_TEST_DATABASE_RESET=1
export E2E_PASSWORD=local-fixture-password
npm ci
npm run check
npm run db:migrate:test
npm run test:integration
npx playwright install chromium webkit
npm run test:e2e
npm run test:e2e:production
```

The destructive seed guard validates both URLs, the database name, loopback hostname, and explicit reset opt-in. It refuses Vercel environments. Do not use localhost forwarding to a real database. The guard cannot determine what a tunnel reaches. Use a genuinely empty database with the default `public` schema for fresh migration checks: the historical initial migration explicitly creates objects in `public`, so a second schema in an existing database is not an isolated migration test.

## Automated regression map

| Risk | Automated coverage | Remaining acceptance |
| --- | --- | --- |
| Privileged access exposed | Logged-out HTML checked for sensitive data; team denied ops; export 401/403 | Exercise each non-admin role and crafted server-action IDs for every mutation |
| Public test passwords | Unit policy/provider/session checks; actual hosted-mode callback and legacy session rejection | Real Google admin sign-in and recovery procedure |
| Google account registration | Actual callback unit tests enforce verified email, explicit Register intent, and existing-user login | External OAuth consent/callback, cookie behavior, and account creation in staging |
| Claim-code guessing/races | PostgreSQL shared request budget, 30 concurrent attempts, expiry, user isolation, unavailable limiter, competing claimants, code rotation during claim | Distributed-account abuse monitoring and real staff retry UX |
| Cross-competition access | REG/judge live API limited to assigned competition; team and comp admin refused | Other role/resource pairs, invitations, changed/revoked memberships |
| Incomplete or duplicate application | Blocked team cannot apply; complete team applies only to open comp; duplicate shown | Server-side concurrent duplicate/deadline/roster-change cases |
| Lost/invalid scores | DB checks invalid fields/ownership, incomplete packets, close/submit ordering, duplicate submission; browser verifies persisted rubric | Network interruption/reconnect, concurrent distinct judges, mobile background/foreground |
| Results released early | DB configured threshold, idempotent release, sealed writes; browser page and CSV/XLSX names hidden until release | Approval/threshold changes during release; operational rehearsal |
| Judging/application state conflicts | PostgreSQL CHECK rejects simultaneous application and judging flags; clean migrations and claim-limit upgrade with synthetic existing rows | Production-sized sanitized upgrade/restore rehearsal |
| REG drives wrong team | Browser selects anonymous slot; live API returns only allowed keys; release clears live position | Real Drive video playback on event network and device |
| Exports broken | Every non-tech role denied; CSV and parsed two-sheet XLSX content before/after release; formula-looking text round trip | Open exports in Excel/Sheets; large realistic datasets |
| Cross-browser failures | Chromium and WebKit desktop suites | Real iPhone Safari and Android Chrome, touch keyboards and poor network |
| Theme preference and form state | System changes, explicit override, navigation/reload, cross-tab sync, pre-hydration styling, invalid/blocked storage, 375px layout, unsaved form preservation in both browsers | Check themed dialogs, status badges, judge/REG screens, and embedded Drive playback on actual devices |

The browser test “Register displays the unknown-account notice (no OAuth round trip)” checks the destination notice only. Callback unit tests cover the registration decision separately. Neither completes external Google OAuth. Keep this distinction in release reports.

## Staging acceptance script

Record deployment SHA/URL, tester, device, time, pass/fail, evidence, and cleanup for each row. Use isolated synthetic accounts and competitions. Every failed case has an issue and accountable owner.

| Role | Steps | Expected result |
| --- | --- | --- |
| New user | Google **Log In** with unknown email; then explicit **Register** | Login creates nothing and points to Register; Register creates one identity; second registration does not duplicate it |
| Existing user | Google login, logout, switch Google account, reload deep link | Correct account/role each time; logout and invalid session cannot access protected data |
| Team primary | Claim synthetic listing, finish profile/roster, apply twice, switch between teams | Only owned teams editable; one application per team/comp; block/deadline enforced on server |
| Competition primary | Inspect applicants before release; invite/approve judge; attempt another competition ID | Names/order remain sealed as specified; invitations scoped; other competition refused |
| Tech admin | Grant/revoke REG, open/close judging, inspect live dashboard, export | Only admin can operate these; mutually exclusive app/judging state; revoked access stops working |
| REG | Open assigned comp, play Drive audition, switch live team, try judging same comp | All judges follow anonymous slot; video works; REG cannot also judge it |
| Judge | Save partial rubric, reload, change score, disconnect/reconnect, complete and submit twice | Persisted values match; visible save failure/recovery; no incomplete submission; sealed packet immutable |
| Final judge/comp | Submit final required packet while another judge submits; refresh results and exports | One release; consistent rankings and names; judging/live state closes; no lost score |
| Operator | Lose network during live viewing; restore it; switch browser/device | Staff can recover from persisted state and know whether an operation saved |

## Failures and maintenance

A failing test blocks merge/promotion. CI rejects `test.only` and treats a retry-only pass as failure. Use the uploaded HTML report and trace to identify the first bad state, reproduce locally, and fix the product or fixture isolation. Never stabilize a test by deleting its important assertion or adding arbitrary sleeps.

Keep CI traces for seven days; this suite has synthetic data. Do not upload traces from real production sessions into public Actions artifacts. Do not parallelize tests sharing a fixture database. After correcting a defect, add the smallest regression that would have caught it and link the issue/PR to its test case.
