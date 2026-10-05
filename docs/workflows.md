# Workflows

Step-by-step recipes for the changes maintainers make most often. Read [setup.md](setup.md) first to run the app, and [tech-chair-handoff.md](tech-chair-handoff.md) for how the system fits together. This repo uses a newer Next.js than most tutorials: check `node_modules/next/dist/docs/` before using a framework API you have not used here.

## Add a page

1. Create `src/app/<route>/page.tsx` as a server component. `params` and `searchParams` are Promises: `const { id } = await params;`.
2. **Check access at the top of the page, before any query.** Layouts and pages render in parallel, so a layout redirect does not protect the page's data.
   - Tech-admin pages: `await requirePlatformAdminPage();` from `src/lib/page-guards.ts`.
   - Other pages: `const session = await auth(); if (!session?.user) redirect("/login");`, then the exact role check from `src/lib/team-access.ts` (`isTeamAdmin`, `isCompAdmin`, `getActiveTeamId`, ...).
3. Only export the default component (and Next's known exports such as `metadata`) from a page file; extra exports break the build.
4. Add a nav link in `src/components/Nav.tsx` if needed, gated on the same role.
5. Add the route to `OPS_PAGES` in `e2e/access.spec.ts` if it is tech-admin only, so CI proves logged-out visitors get nothing.

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
4. Run the tests ([below](#run-the-tests)); the e2e setup applies every migration to a fresh database.
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

**Unit tests** (no database): `npm test`. Files live next to the code as `src/**/*.test.ts`.

**Browser tests** need a throwaway Postgres. The fixture seed wipes every table and refuses any host but localhost.

1. Start a local database, either way:
   ```bash
   # Docker
   docker run --name onelegends-e2e -e POSTGRES_HOST_AUTH_METHOD=trust \
     -e POSTGRES_DB=onelegends_e2e -p 54329:5432 -d postgres:16

   # or Homebrew Postgres (data stays in the gitignored .e2e-pg/ folder)
   initdb -D .e2e-pg/data -U postgres --auth=trust
   pg_ctl -D .e2e-pg/data -o "-p 54329 -k $PWD/.e2e-pg" -l .e2e-pg/log.txt start
   createdb -h 127.0.0.1 -p 54329 -U postgres onelegends_e2e
   ```
2. Point the shell at it and run:
   ```bash
   export DATABASE_URL=postgresql://postgres@127.0.0.1:54329/onelegends_e2e
   export DIRECT_URL=$DATABASE_URL
   export E2E_PASSWORD=any-local-password
   npx prisma migrate deploy
   npx playwright install chromium   # first time only
   npm run test:e2e
   ```
   The run builds the app, starts it on port 3100, and re-seeds before each run. Add `E2E_SKIP_BUILD=1` to reuse the last build. Explicit environment variables win over `.env`, so your Supabase URL is not used.
3. On failure, open the trace: `npx playwright show-trace test-results/<test>/trace.zip`.

**CI** (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, and the browser tests against a Postgres container on every push to `main` and every pull request. Failed browser runs upload the report and traces as an artifact.

Before pushing: `npm run lint`, `npx tsc --noEmit -p .`, `npm test`, and `npm run build`. If `tsc` complains about `LayoutProps` or `PageProps`, run `npx next typegen` first.

## Commit

1. Commits must be authored by the circuit account so Vercel deploys them. This repo sets it locally; check with `git log -1 --format='%an <%ae>'`. Do not change your global git config for this.
2. Write the message as what changed and why, in a sentence (see `git log`).
3. Add a line to [CHANGELOG.md](../CHANGELOG.md) under **Unreleased** for anything that changes behavior, data, or setup.
4. Never commit `.env` or `docs/CREDENTIALS.md` (both gitignored).

## Deploy and roll back

1. Pushing to `main` on `github.com/ddnlegends/onelegends` runs CI and deploys to Vercel.
2. New environment variables go in Vercel → Project → Settings → Environment Variables, pasted without quotes; redeploy afterwards.
3. Schema changes: apply the migration to Supabase **before** the code that needs it goes live.
4. Roll back code with Vercel's **Instant Rollback** to the previous deployment, then revert the commit on `main`. A migration cannot be rolled back that way; write a new migration that undoes it, after a backup.
5. After a deploy, smoke-test Google sign-in, a team application, and the tech-admin Teams page while logged out (it must redirect).
