# Workflows

Step-by-step recipes for the changes maintainers make most often. Read [setup.md](setup.md) first to run the app, and [tech-chair-handoff.md](tech-chair-handoff.md) for how the system fits together. This repo uses a newer Next.js than most tutorials: check `node_modules/next/dist/docs/` before using a framework API you have not used here.

## Add a page

1. Create `src/app/<route>/page.tsx` as a server component. `params` and `searchParams` are Promises: `const { id } = await params;`.
2. **Check access at the top of the page, before any query.** Layouts and pages render in parallel, so a layout redirect does not protect the page's data.
   - Tech-admin pages: `await requirePlatformAdminPage();` from `src/lib/page-guards.ts`.
   - Other pages: `const session = await auth(); if (!session?.user) redirect("/login");`, then the exact role check from `src/lib/team-access.ts` (`isTeamAdmin`, `isCompAdmin`, `getActiveTeamId`, ...).
3. Only export the default component (and Next's known exports such as `metadata`) from a page file; extra exports break the build.
4. Add a nav link in `src/components/Nav.tsx` if needed, gated on the same role.
5. Add the route to `OPS_PAGES` in `e2e/access.spec.ts` if it is tech-admin only, so CI checks logged-out visitors receive no protected data.

## Style a page

Use the semantic colors in `src/app/globals.css`: `bg-paper` for the page, `bg-card` for panels and fields, `bg-blush` for subtle surfaces, and `text-ink`, `text-muted`, `text-accent`, and `border-line`. Status colors use `success`, `warning`, `danger`, `info`, and `ready`, each with `-soft` backgrounds and `-line` borders. These tokens adapt to light and dark themes. Keep `brand` fills for white-label buttons; `accent` is a readable foreground and changes between themes.

The root layout's fixed inline script applies the saved/device preference before paint. `ThemeSelect` handles changes, system updates, and cross-tab storage events. Keep their resolution logic in sync. Check both themes at desktop and phone widths, including focus, errors, dialogs, and unsaved forms. `e2e/theme.spec.ts` runs in the existing Chromium/WebKit CI jobs.

## Add a server action

1. Put it in the matching file in `src/app/actions/` (each has a header saying what it covers), under `"use server"`.
2. Start with `const user = await requireUser(); if (!user) return { error: "..." };`, then the role check. Never trust IDs from the form without checking the user may touch that row.
3. Validate input on the server. Return `{ ok?: boolean; error?: string; message?: string }` so `SaveNotice` can show it, and call it from the client with `useActionState`.
4. If two people can change the same row at once (judging, release, admin counts), do the check and the write in one `prisma.$transaction`: lock the row with `SELECT ... FOR UPDATE`, or use a conditional `updateMany` and check `count`. See `src/app/actions/judge.ts` and `src/lib/release.ts`.
5. `revalidatePath` every route that shows the changed data.
6. Server-only libraries (`googleapis`, `node:crypto`, `exceljs`) must not end up in a module that a client component imports. Client components import judging helpers from `src/lib/judging-rules.ts` and photo helpers from `src/lib/team-photo-rules.ts`; keep both free of Prisma and server-only imports. Prefer the default `<Link>` prefetch: a bare `prefetch` renders the whole target page in the background for every visible link.

## Add a database change

1. Edit `prisma/schema.prisma`.
2. Generate the migration against a **local** database, never Supabase:
   ```bash
   DATABASE_URL=postgresql://postgres@127.0.0.1:54329/onelegends_e2e \
   DIRECT_URL=postgresql://postgres@127.0.0.1:54329/onelegends_e2e \
   npx prisma migrate dev --create-only --name describe_the_change
   ```
3. Read the generated SQL in `prisma/migrations/<timestamp>_describe_the_change/`. Add data backfills or `CHECK` constraints by hand if needed.
4. Run `npm run db:migrate:test` against a fresh disposable database, then the tests ([below](#run-the-tests)). Browser setup resets fixture rows; it does not apply migrations.
5. To ship: back up Supabase, then `npm run db:migrate` with production URLs, then deploy the code. Never run `prisma migrate reset` or `npm run db:seed` against Supabase.

## Add a role or permission

1. Add the lookup to `src/lib/team-access.ts` (wrap it in React `cache` like the others).
2. Use it in both the page guard and every action that changes that data; one without the other is a hole.
3. Update the role table in [board-guide.md](board-guide.md#who-can-see-what).
4. Add an e2e check that a user without the role is refused.

## Add an export dataset

1. Add an entry to `EXPORT_DATASETS` and a builder to `BUILDERS` in `src/lib/ops-export.ts`. The export page and route pick it up automatically.
2. Keep the anonymity gate: before `resultsReleasedAt`, show `Team N` (use `teamLabel`) and never team names or viewing order.
3. Extend `src/lib/ops-export.test.ts` if the dataset adds formatting rules.

## Run the tests

See [regression-testing.md](regression-testing.md) for the single canonical local/CI recipe, isolation requirements, coverage map, and staging acceptance script. `npm run check` runs lint, generated route types, typecheck, and unit tests. `npm run test:integration` uses real disposable PostgreSQL. `npm run test:e2e` builds and runs Chromium/WebKit; `npm run test:e2e:production` then tests the hosted authentication boundary using that build.

CI runs those checks plus a high-severity production dependency audit. The **Release gate** fails if any prerequisite fails, is skipped, or is cancelled. It does not deploy. Configure GitHub and Vercel to require the gate as described in [release-runbook.md](release-runbook.md). Scoped dependency fixes and the remaining development-tooling advisory are recorded in [dependency-security.md](dependency-security.md).

## Commit

1. Commits must be authored by the circuit account so Vercel deploys them. Verify the authorized commit identity before publishing; check with `git log -1 --format='%an <%ae>'`. Do not change your global git config for this.
2. Write the message as what changed and why, in a sentence (see `git log`).
3. Add a line to [CHANGELOG.md](../CHANGELOG.md) under **Unreleased** for anything that changes behavior, data, or setup.
4. Never commit `.env` or `docs/CREDENTIALS.md` (both gitignored).

## Deploy and roll back

Follow [release-runbook.md](release-runbook.md) for protected branches, Vercel checks, migrations, smoke tests, rollback, and incident response. A push to `main` can trigger both CI and Vercel; these happen independently until the owner enables deployment checks. Never infer that a deployment waited for tests just because both exist.
