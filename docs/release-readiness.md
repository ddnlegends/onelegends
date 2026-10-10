# Release readiness — 6 October 2026

**Status: not approved for production.** This review starts at commit `f5f4530753bc03e20c46b10afefdf5f1bd015676`. The local `release/readiness-hardening` branch contains proposed fixes and checks. A successful local test run does not activate GitHub or Vercel controls. See [release-runbook.md](release-runbook.md) for activation and sign-off.

**10 October production update:** Commit `c81222be63ce489315d8fddf1c9e29cf476aef67` is deployed and its GitHub Release gate passed. The live site initially rendered a server error because `20261008230000_judge_panel_finalization` had not been applied. A backup of the confirmed production database was taken; its application schema restored to an isolated PostgreSQL 17 instance, and both pending migrations passed there. `20261008230000_judge_panel_finalization` and `20261010120000_dancer_sober_monitor` were then applied to production. Prisma now reports 24 migrations current, and the public home page renders the competition list without a stream error. The full Supabase-specific backup could not be restored outside Supabase because the local server lacks `supabase_vault`; the application schema restore succeeded. Vercel's database, auth, and Sheets service-account secrets are now scoped to Production only for new deployments. Existing Preview deployments may still hold the previous environment snapshot until expiry or credential rotation. The four demonstration password logins remain temporarily available for testers at the owner's request.

**Launch approval is still pending.** `main` has no required GitHub ruleset or branch protection, and Vercel's Release gate deployment check has not been verified. All three historically published competition claim codes that were still active in production have been rotated without changing ownership; the two replacement codes for unclaimed competitions must be distributed privately to their intended hosts. The four demonstration accounts exist with password hashes and expected access, but real Google sign-in, full backup restoration, capacity and alerting, payment policy, and named operational sign-offs remain to be completed or explicitly accepted by their owners. The later build-time production schema check blocks new production builds when migrations are pending; it does not replace those release controls.

**7 October integration update:** the branch is published and now incorporates main's Moderator naming, payment recipient, competition partner labels, logo wording, and early/late deadlines, plus dark mode. The evidence below records the original 6 October audit; current merge validation is recorded in the pull request and its Actions run. Repository ruleset listing currently returns no rulesets. Production migration, external OAuth, capacity, and hosting-control verification remain separate release requirements.

**9 October follow-up:** a later, user-requested change temporarily restores production password login for four named demonstration accounts so other people can test each role. The local-only password guard and hosted-auth evidence below describe the earlier state. Current policy and tests are in `src/lib/test-environment.ts`, `src/lib/auth-policy.ts`, and `e2e-production/auth.spec.ts`. Verify the four account hashes and permissions, rotate exposed credentials, and remove this access after testing.

## Launch blockers

| Priority | Finding and evidence | Required closure |
| --- | --- | --- |
| P0 | Password authentication in `src/auth.ts` accepted published legacy test credentials, including a tech admin. Seed passwords were literal strings. | Deploy the local-only test-login guard; verify a real administrator can use Google first. The change invalidates sessions without provider provenance once, and hosted credential sessions on every request. Rotate exposed passwords wherever reused; review privileged users and access history. |
| P0 | `prisma/season-comps.ts` contained claim codes in a public repository. Whether those codes remain active is unknown. | Ops must inspect affected production listings and rotate any exposed active code while preserving ownership. Removing the constants does not revoke existing codes. Do not use “reopen claim” as a casual rotation tool: it clears administrators. New local seeds now generate random codes. |
| P1 | Git integration deploys from `main`; no gate is enforced merely by adding an Actions file. Public ruleset read returned `[]`; classic branch-protection read returned 403, so protection is unverified. | Repository owner enables and verifies required **Release gate**, review requirements, and Vercel deployment checks. Prove a deliberately failing test prevents merge and production promotion. |
| P1 | Real Google OAuth registration/login, callback URLs, provider status, and admin recovery were not exercised. The old “unknown Google email” browser test only visits a notice URL. | Complete the staging OAuth acceptance cases in [regression-testing.md](regression-testing.md), then smoke-check production configuration with a controlled account. |
| P1 | Launch traffic, peak concurrency, staging isolation, database tier, connection headroom, and backup restoration have not been measured here. | Name a release owner, confirm expected peaks, run staging capacity tests, and restore a backup into an isolated database. Attach timings and dashboards. “A few thousand users” is not a concurrency measurement. |

The original production dependency findings are resolved locally by a supported Sharp patch and scoped Prisma/ExcelJS dependency overrides. The production audit reports zero vulnerabilities. Full audit still reports one unpatched development-tooling advisory through five packages; see [dependency-security.md](dependency-security.md) for scope, compatibility evidence, and maintenance. Re-run both audits at release time because the advisory database changes.

## Changes prepared in this branch

- Explicit local-only password login at the provider, action, UI, and session boundaries. A Vercel deployment refuses it even if the flag is accidentally enabled. Google sign-in requires a verified-email assertion; callback tests cover registration intent and existing-user login.
- Both destructive seeds require an opt-in and both database URLs must name a loopback `onelegends_e2e` database. The test migration command checks those targets before invoking Prisma. Seed passwords come from environment variables; committed competition codes are removed.
- Score saves and packet submission lock the competition before the assignment. Submission rechecks the competition state after obtaining the locks. Explicit finalization evaluates the active approved panel under the competition lock. Conditional writes prevent reopening released judging or changing the judge panel after release.
- Claim preview/confirmation actions share a PostgreSQL-backed budget of 20 requests per account per 15 minutes. Concurrent requests cannot exceed it; failed requests do not extend the cooldown. Claim writes recheck the code so rotation invalidates an in-flight attempt. Deploy the additive migration before the app.
- Real PostgreSQL tests cover access denial, incomplete packets, close/submit ordering, duplicate submission, sealing, active-panel finalization, the application/judging database constraint, claim limits, competing claimants, and code rotation.
- Browser cases reset fixture data before every test/retry, exercise Chromium and WebKit, verify the stored rubric and sealed/released CSV/XLSX content, and deny cross-competition live-state access. A separate hosted-mode suite bypasses the UI and attempts credentials authentication directly.
- CI has bounded jobs, read-only tokens, pinned actions, isolated Postgres per browser, retained reports, a production dependency-audit gate, merge-queue support, and a single required release check. Dependabot and a PR evidence template support ongoing maintenance.

## Remaining review items

1. **Claim abuse:** the new limit is per account, not per network or coordinated attacker. Confirm the allowance with ops and add hosting abuse monitoring. A preview plus confirmation uses two requests; normal cooldown lasts at most 15 minutes.
2. **Additional races:** concurrent invitations, role changes, resetting owned listings, application deadline changes, and judging approval changes need targeted concurrency coverage. The added transaction tests cover specific judging and claiming invariants, not every mutation.
3. **Lock contention:** the hardening serializes short scoring transactions per competition. Measure concurrent score-save latency and transaction timeouts during the staging rehearsal; database correctness does not establish throughput.
4. **Payments:** main now supplies the manual Zelle/PayPal recipient `legends@desidancenetwork.org`. Confirm the amount, recipient, and payment memo with the board before collecting payments; automated payment confirmation remains outside the app.
5. **Privacy:** decide whether public team photos and production details are intended. Automated export tests now inspect CSV and parsed XLSX before and after release; repeat the operational acceptance with realistic synthetic data and intended access roles.
6. **Operations:** add attributable audit records for access grants, score submission, results release, claim reset, and data export. Confirm exception alerts, a live event support contact, and rollback access.

## Evidence boundaries

The prior main-branch [CI run](https://github.com/ddnlegends/onelegends/actions/runs/37387643756) succeeded. This review does not claim that the new branch has run on GitHub. The connected repository permission is read-only. No production database, account, judging state, deployment, or repository setting was changed. No live load test was run. Detailed local verification is recorded below after execution.


## Public smoke observation

On 6 October 2026, read-only requests to the supplied production URL returned 200 for `/` and `/login`; the login page displayed both the Google button and legacy test-password form. Anonymous live-state and export requests returned 401. No password was submitted, and no authenticated production workflow was exercised. A visible Google button proves configuration is present, not that OAuth succeeds.


## Local verification results

Executed on macOS ARM64 with Node 22.23.3, PostgreSQL 16.14, and the lockfile dependencies. GitHub uses Linux runners and still needs its own run. No production services or real user data were used for automated tests.

| Check | Result |
| --- | --- |
| `npm ci` | Pass: clean install and Prisma client generation with the final lockfile |
| `npm run check` | Pass: lint, typecheck, 59 unit/security/compatibility tests across 8 files |
| Fresh `prisma migrate deploy` | Pass: all 17 migrations applied to an empty disposable PostgreSQL database using its public schema |
| Claim-limit upgrade migration | Pass: migration 17 applied over the prior 16; existing 5 users, 3 teams, 3 competitions, and 2 applications retained; new user fields have empty/zero defaults. Synthetic fixtures only |
| `npm run test:integration` | Pass: 15 database transaction/constraint regressions |
| `CI=1 npm run test:e2e` | Pass: 38 browser tests (19 Chromium + 19 WebKit), no retries needed; 37 seconds. Production build passed with the final app code/lockfile; final test-only fixes reused that build |
| `CI=1 npm run test:e2e:production` | Pass: 3 hosted authentication-boundary tests; 2 seconds |
| GitHub Actions validation | Pass: actionlint 1.7.12, YAML parse, diff whitespace check |
| Documentation links | Pass: all local links in the changed documentation resolve |
| Production dependency audit | Pass: zero vulnerabilities after scoped fixes; full development-inclusive audit still flags the unpatched lint-tooling advisory |
| Load-script functional check | Pass: 2 local clients for 5 seconds; production-host refusal verified. This is only a tool smoke test, not capacity evidence |
| Real OAuth, staging writes, peak-load, backup restore | **Not performed**; require the staging environment and accountable operators |

Successful browser runs emitted Next.js “destination stream closed early” logs around navigation/redirect activity. These did not fail the assertions; their cause was not independently diagnosed. Check for them during normal staging use and inspect any associated user-visible failure before release.

The final total is **115 passing tests**: 59 unit/security/compatibility, 15 database, 38 browser, and 3 hosted-authentication tests. Initial expanded export tests had Playwright module-import setup failures; those were corrected, the export subset passed in both browsers, and the complete final run passed without retries. This evidence establishes the listed regressions, not production capacity or external OAuth success.

Local HTML reports are in the gitignored `playwright-report/` and `playwright-report-production/` directories. CI uploads separate synthetic-data reports for each browser and the hosted-auth suite. The checked-in workflow has not been executed or enforced on GitHub yet.
