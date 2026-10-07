# Technical chair handoff

This is the starting point for future maintainers. Read [setup.md](setup.md) to run the app and [board-guide.md](board-guide.md) for operational workflows.

## System map

- **App:** Next.js App Router and React. Server-rendered pages live in `src/app`; interactive forms in `src/components`.
- **Server writes:** `src/app/actions` contains validated actions for profiles, applications, access, judging, and operations. Pages that show private data also check access before querying it.
- **Identity:** Auth.js configuration in `src/auth.ts`; user rows in Prisma. Google OAuth is the normal login. The exact allowlist in `src/lib/auth-policy.ts` retains password sign-in for existing test accounts only. Auth.js is separate from Supabase Auth. Log In and Register share one Google provider: `googleSignInAction` in `src/app/actions/auth.ts` sets a short-lived `ol_auth_intent` cookie, and the `signIn` callback only creates users when the intent is `register`. Otherwise an unknown email is redirected to `/register?error=no-account`.
- **Data:** Supabase PostgreSQL through Prisma in `src/lib/prisma.ts`; schema in `prisma/schema.prisma`; versioned SQL in `prisma/migrations`. `DATABASE_URL` uses the transaction pooler for app queries; `DIRECT_URL` uses the session/direct connection for migrations.
- **Media:** Team photos are stored in the database and served by `src/app/api/teams/[id]/photo`. AVs are external Google Drive file links; no video upload or transcoding is provided.
- **Integrations:** Optional applicant Google Sheet sync uses a service account (`src/lib/sheets.ts`) and refuses to run before results release. Tech-admin downloads are built in `src/lib/ops-export.ts` and served by `src/app/api/ops/export/route.ts` (platform admins only; `dataset` can repeat, `format` is `xlsx` or `csv`, optional `competitionId`). Payment is manual via Zelle or PayPal to `legends@desidancenetwork.org`, and no payment status is inferred by the app.

## Data and permission model

`User` may hold team and competition memberships, judge assignments, moderator access, and the `platformAdmin` flag. A user can wear more than one role. `TeamProfile` owns dancers, membership, applications, and `applyBlocked`/`applyBlockReason`. `CompetitionProfile` owns applications, judging configuration, approved judge assignments, and `resultsReleasedAt`. `Application` joins one team to one competition, with a unique pair. The active team and competition selection is stored in HTTP-only cookies and checked against approved membership each time.

The Prisma `ModeratorAccess` and `ModeratorInvite` models map to the existing database tables, so current assignments and pending invites remain valid. Old `/reg` links redirect to `/moderator`.

For new sensitive pages, enforce authorization in the server page or action. The navigation and parent layouts are convenience gates, not a substitute for checking the exact team or competition. In this Next.js version, layouts and pages render in parallel, so a `redirect()` in a layout does **not** stop the page from querying and streaming its data to a logged-out visitor. Every page that reads private data must check access itself; ops pages call `requirePlatformAdminPage()` from `src/lib/page-guards.ts`. Competition full-roster access requires an approved admin for the active competition, a released result, and an application joining that competition to the requested team. Circuit tech admin's `/ops/teams` route is unrestricted across teams but restricted by `platformAdmin`. Legacy `/teams` routes redirect away from general users to avoid exposing the global directory.

Anonymous judging depends on `src/lib/judging.ts`. The competition views counts until `resultsReleasedAt` is set, after the required judge submissions. Do not reveal names through a new API, spreadsheet, export, or component before that gate. Moderators and judges both see only team numbers. Opening judging closes applications; a database constraint also rejects a state with both `acceptingApps` and `judgingOpen` true.

The pure judging rules (rubric, lifecycle gates, score math) live in `src/lib/judging-rules.ts`, which client components import, so keep it free of Prisma and other server-only dependencies (such as `googleapis`); otherwise the build fails or the code ships to the browser. `src/lib/judging.ts` re-exports those rules and adds the server-side viewing-order helpers. Release lives in `src/lib/release.ts`: `maybeReleaseResults` sets `resultsReleasedAt` with a conditional update so it fires once, then syncs the applicant sheet. Judge score saves and packet submits lock the `JudgeAssignment` row (`SELECT … FOR UPDATE`) and re-check submit and lock state inside the transaction. On the client, `JudgeScoreForm` sends saves for one sheet through an ordered queue so an older save cannot overwrite a newer one. Removing a platform admin takes an advisory lock so two admins cannot remove each other and leave none.

## Common change workflow

Step-by-step recipes for pages, actions, migrations, permissions, exports, tests, commits, and deploys are in [workflows.md](workflows.md).

1. Pull `main`, install the locked npm dependencies, and read the versioned Next.js guides under `node_modules/next/dist/docs/` before changing framework APIs.
2. Make a focused change. For data changes, edit `prisma/schema.prisma` and add a numbered SQL migration in `prisma/migrations`; never hand-edit production tables without recording the migration.
3. Run `npx prisma generate`, `npm run lint`, `npm test`, `npm run test:e2e` (needs a local Postgres; see [workflows.md](workflows.md#run-the-tests)), and `npm run build`. CI runs the same checks on every push and pull request. Build output should not contain Prisma missing-column errors.
4. Add a line to [CHANGELOG.md](../CHANGELOG.md) under **Unreleased**.
5. Back up Supabase before a production migration. Apply with `npm run db:migrate`; do not run `npm run db:seed` against a populated database because it deletes app data.
6. Set new deployment environment variables, deploy the code, and verify Google sign-in (Log In with an existing account and Register with a new one), a team application, competition access before and after release, the admin Teams and Competitions lists while logged out (they must redirect and show nothing), and an export download. Roll back code and database thoughtfully if a migration changed stored data.

## Operations and troubleshooting

- **Google button absent:** `AUTH_GOOGLE_ID` or `AUTH_GOOGLE_SECRET` is missing. Set both on the host and redeploy. Confirm `AUTH_URL` and the exact callback `{AUTH_URL}/api/auth/callback/google` in the Google OAuth Web client. Existing test logins are the only password exception.
- **OAuth callback error:** Check the registered origin and redirect URI, deployment URL, client ID/secret, and Google OAuth consent configuration. Use the same canonical host for `AUTH_URL` and the redirect.
- **`Error 401: invalid_client` in production only:** The host's `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` were pasted with quotes or spaces, or belong to a different OAuth client. Re-enter them bare, set `AUTH_URL` with no trailing slash, and redeploy.
- **"No account" notice on Register:** That Google email has no OneLegends account. The user should press Continue with Google on Register, not Log In.
- **Team cannot change its AV link:** The team is in a viewing order and results are not released yet. Fix sharing on the existing Drive file instead.
- **Database or missing column error:** Check Supabase availability, pooler URLs, and `npx prisma migrate status`; apply pending migrations. Never repair by reseeding a populated project.
- **Invite not visible:** Confirm the invited email exactly matches the Google account email. Invites are displayed inside the app at the next sign-in and no email is sent.
- **Team cannot apply:** Check profile completeness, roster, circuit block reason, competition accepting flag, deadline, and whether judging/results are already open. The block reason is an admin note; there is no MOU API.
- **Competition cannot see rosters:** Team details unlock only after results release for its applied teams. Check approved competition admin membership and active competition selection. Circuit admins can use `/ops/teams` regardless of results state.
- **Payment confusion:** The app shows `legends@desidancenetwork.org` for Zelle or PayPal. Confirm the recipient and amount with circuit ops or the host; verify receipts manually before clearing a block.

## Release and handoff checklist

- Maintain organization ownership of GitHub, hosting, Google Cloud OAuth, Supabase, domain, and Google Sheets service account. Keep secrets out of source control and rotate them on officer turnover.
- Confirm `AUTH_SECRET`, `AUTH_URL`, Google OAuth credentials, and both Postgres URLs in the deployment secret store. Revalidate callback URLs after a domain change.
- Back up data, apply migrations, run checks, and review role access with a non-admin Google account and the authorized admin account.
- Review platform admins, competition admins, team admins, judges, and moderator access; revoke departing officers.
- Review block reasons, payment instructions, competition deadlines, required judge counts, and Drive link sharing before the season.
- Update this guide, [action-items.md](action-items.md), and [CHANGELOG.md](../CHANGELOG.md) when behavior changes. Direct primary ownership transfer, year-specific partner listings, and integrated payment confirmation remain planned work.
