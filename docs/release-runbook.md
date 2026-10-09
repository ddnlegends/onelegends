# SDLC and release runbook

This is the operating procedure for this week's release and later changes. Pair it with [release-readiness.md](release-readiness.md) and [regression-testing.md](regression-testing.md). Proposed controls are only active once the repository and hosting owners configure and verify them.

## Ownership and development

Name a release lead, technical approver, competition-operations tester, and incident responder before launch. One person may cover multiple roles, but the author should not be the only reviewer of authentication, permissions, scoring, migrations, or production configuration.

1. Work on short-lived branches from `main`. Each change states the user outcome and acceptance criteria, including who must be denied access.
2. Keep PRs scoped; require one approving review, no unresolved review threads, and green required checks on the current commit. Re-request approval after changes to sensitive code.
3. Use `npm ci`, then `npm run check`. Run database/browser regression for behavior changes. Never commit credentials, session cookies, production exports, or traces containing real users.
4. Review migration SQL, environment changes, compatibility with the previous release, and rollback steps in the PR template. Add the changelog entry before merge.
5. During launch week, freeze nonessential features. Every emergency fix still needs a reviewer, targeted regression, recorded SHA, and an incident note. Follow up within one working day on any manually bypassed control.

## Environments

| Environment | Data and credentials | Purpose |
| --- | --- | --- |
| Local/CI | Disposable loopback `onelegends_e2e`, generated fixtures, fake auth secret, no Google/Sheets keys | Automated tests, destructive seed, migrations from empty DB |
| Staging/preview | Separate Supabase project, synthetic data, separate OAuth client/service credentials | Real Google login, device rehearsal, upgrade/restore rehearsal, capacity tests |
| Production | Production-only DB and OAuth settings, four temporary demonstration passwords | Real users and controlled role testing; remove demonstration access after testing |

Preview deployments must never inherit production database URLs. Preview code is executable code with access to its environment secrets. Hosted staging uses Google; password login is unavailable there. Production temporarily permits only the four demonstration emails listed in `src/lib/auth-policy.ts`; those account rows and password hashes must already exist.

## Activate the release gates (owner action)

1. Push this branch for a first CI run, configure required checks, then merge through review after addressing the findings. A new workflow check may need one initial run to appear in settings. The production dependency audit is clean locally; require a fresh passing audit on the release SHA. Review the separate development-tooling advisory in [dependency-security.md](dependency-security.md).
2. In GitHub, protect `main` with a ruleset or classic protection: require PRs, one approval, resolved conversations, current checks/up-to-date branch or merge queue, and **Release gate**. Block force-push/deletion and routine bypass. If using a merge queue, the workflow supports `merge_group`.
3. In Vercel's Deployment Checks, add the GitHub **Release gate** check for production. Confirm the check belongs to the exact commit being promoted. Keep automatic aliasing enabled when using this mechanism. Vercel holds promotion until required checks pass; the detailed behavior is in [Vercel Deployment Checks](https://vercel.com/docs/deployment-checks).
4. If that feature is unavailable, disable automatic production promotion and use an explicitly approved, staged production deployment, checking the exact SHA and test evidence before promotion. Do not have both automatic Git production deployment and a separate ungated deploy workflow running.
5. Verify with a harmless failing test on a branch: PR cannot merge, production cannot promote, the previous deployment remains live. Then remove the test and demonstrate green recovery. Save evidence.

No production deploy token is needed by this CI workflow. It neither deploys nor runs production migrations. The pipeline is:

```text
PR -> lint/typecheck/unit + production dependency audit
   -> migrated disposable Postgres -> transaction tests
   -> production build -> Chromium + WebKit -> hosted auth rejection
   -> Release gate -> reviewed merge -> Vercel production build
   -> Vercel checks on that SHA -> promotion -> production smoke
```

## Release checklist

Record date/time in Eastern Time, release SHA, Vercel deployment ID/URL, previous known-good deployment, migration list, and named sign-offs in the release record.

- [ ] Every P0/P1 finding closed or explicitly accepted by its accountable owner with evidence and expiry; no silent waiver in CI.
- [ ] CI **Release gate** is green for the exact release SHA. No ignored failure, skipped prerequisite, focused test, or flaky-pass acceptance.
- [ ] Staging role matrix, real Google Register/Log In, Safari/iPhone and Chrome/Android rehearsal passed.
- [ ] Privileged admin Google login verified before removing password access. Expect all older sessions to need one fresh login with this rollout.
- [ ] Exposed passwords and still-active published claim codes handled; privileged membership review complete.
- [ ] Separate environment URLs verified without posting secrets. Google callback URL matches the exact production `AUTH_URL`; provider app access/publication settings permit intended users.
- [ ] Backup taken and an earlier backup successfully restored to an isolated DB. Record restore duration and acceptable data-loss window.
- [ ] Capacity evidence accepted against expected peaks and hosting/database limits. Application and database error alerts route to a named responder.
- [ ] Payment destination and board policy decisions resolved. Event staff can use the app and export fallback if Sheets sync fails.

## Schema and rollout

Apply only reviewed, backward-compatible migrations with `npm run db:migrate` using the intended protected environment. Confirm `npx prisma migrate status` before and after. Never run seed/reset against production. The local guard is a second line of defense, not a reason to put production URLs in a developer shell.

The Point of Contact change adds `20261009120000_dancer_point_of_contact`. Apply it before deploying code that reads the new column. Existing roster rows receive `false`; the previous app ignores the column if a code rollback is needed. Confirm the four production demonstration accounts exist with password hashes and the intended access before inviting testers.

Test both a clean migration and an upgrade of a restored, sanitized prior schema with representative rows. For destructive schema work, use expand/migrate/contract: add compatible schema, deploy code that handles both, backfill and verify, then remove old schema in a later release. Do not make the app deploy depend on a migration that has not completed.

This branch adds `20261006170000_claim_attempt_limits`: two columns on `User` and a nonnegative-count constraint. Apply it **before** deploying the new app. Existing users start with an empty attempt window and zero attempts. Old app code ignores these columns, so leave them in place during any code rollback. The limiter fails closed if its table query is unavailable; an app deployed before the migration will refuse all claims. The local upgrade check preserved synthetic rows; a production-sized upgrade/backup rehearsal is still required. PostgreSQL takes a table lock for the schema change, so schedule it outside an active judging window and observe lock waits.

Claim previews and confirmations share 20 requests per account per 15 minutes across teams and competitions. A normal claim consumes two requests. Denied attempts do not prolong the window. This database-backed limit applies across server instances; it does not limit attackers creating many accounts. Alert on `claim_rate_limit_unavailable` and keep edge-level abuse protection under hosting operations.

Build the production artifact with production settings. A staging artifact built against a staging DB is not evidence that the production artifact has correct environment configuration. Verify and promote the production candidate for the tested SHA. See [Vercel promotion](https://vercel.com/docs/deployments/promoting-a-deployment).

## Post-deploy smoke and observation

Immediately check the production home, real Google sign-in with a controlled existing account, account role, logged-out `/ops/teams` redirect, and unauthenticated export/live API denial. Use an approved synthetic competition for write checks; never submit a real judge packet or release results as a smoke test. Check Vercel errors and Supabase connections/latency for at least 30 minutes and during the first live judging session.

Suggested initial alert/stop thresholds, to confirm against baseline: unexpected 5xx above 1% for 5 minutes, score-save p95 above 1 second for 5 minutes, pool timeouts, sustained DB connections above 80% of the configured limit, or any unauthorized data disclosure/lost score. Any confidentiality or score-integrity issue stops rollout immediately even below those aggregate thresholds.

## Incident and rollback

1. Incident responder records onset, affected competition/roles, deployment SHA, symptoms, and last known-good operation. Keep credentials and team data out of public issues.
2. For scoring integrity issues, ops closes judging while the responder investigates; tell event staff which actions to pause through the established support channel.
3. If the previous app is schema-compatible and retains the required authentication protections, use Vercel Instant Rollback to the recorded deployment; verify traffic actually uses it and rerun smoke. The pre-hardening baseline permits published test passwords, so it is **not a safe security rollback target**. If no safe earlier build exists, prepare a forward fix retaining the auth guard. Follow any rollback with a reviewed revert on `main` so the next deploy does not reintroduce the fault.
4. A code rollback does not undo migrations or restore lost data. Use a reviewed forward migration or coordinated restore with the owner; reconcile any writes since the backup. Never blindly revert SQL under active users.
5. Retain sanitized logs and timestamps, assign the root cause, add a reproducing regression, and document recovery time and prevention before normal feature work resumes.
