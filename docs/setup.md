# Setup

Node 20.9+ (22 in `.nvmrc`) and npm. The database is hosted Postgres on [Supabase](https://supabase.com/). There is no local database.

```bash
nvm use          # or any Node 20.9+
npm install
cp .env.example .env
```

Change `AUTH_SECRET` before a public deploy (`openssl rand -base64 32`). Keep `.env` out of git.

## Environment

Login uses Auth.js, while Supabase hosts Postgres. You need Postgres URIs, not Supabase anon keys. Google is the only sign-in path for regular accounts. Existing test accounts retain their password login; new password accounts cannot be created.

Google on **Register** creates an account. Google on **Log In** only signs in an email that already has an account; an unknown email is sent to `/register?error=no-account` and nothing is created.

Before launch, create a Google OAuth 2.0 Web client. Set the authorized JavaScript origin to the exact site origin and the authorized redirect URI to `{AUTH_URL}/api/auth/callback/google`. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in the deployment environment, as well as `AUTH_SECRET` and the production `AUTH_URL`. Add localhost origin and callback to the client if local Google sign-in is needed. Restart or redeploy after setting these values. Without them, regular users cannot sign in; the existing test logins still work.

In the hosting dashboard (for example Vercel), paste values **without quotes** and without trailing spaces, and set `AUTH_URL` with **no trailing slash** (`https://example.org`, not `https://example.org/`). Quoted or padded values are the usual cause of Google's `invalid_client` error in production while local works.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | App queries. Transaction pooler, port **6543**, with `pgbouncer=true`. |
| `DIRECT_URL` | yes | Migrations. Direct or session pooler, port **5432**. |
| `AUTH_SECRET` | yes | Signs the login cookie. |
| `AUTH_URL` | yes | Site origin (`http://localhost:3000` locally). |
| `AUTH_GOOGLE_ID` | launch | Google OAuth client ID. Shows Continue with Google when set with the secret. |
| `AUTH_GOOGLE_SECRET` | launch | Google OAuth client secret. Redirect URI is `{AUTH_URL}/api/auth/callback/google`. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | no | Optional applicant Sheet sync. Not needed for tech-admin downloads. |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | no | Optional Sheet sync. Keep `\n` as in the JSON key. |

URI-encode special characters in the database password (`@` → `%40`).

Do not run `prisma migrate reset` or `npm run db:seed` against a populated Supabase project. The seed deletes users and applications before restoring unclaimed listings. Back up production data before migrations and use seed only for a disposable environment.

## Database and run

```bash
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For a fresh disposable database only, run `npm run db:seed` to create listings and the Legends Admin test login. It does not create dance-team accounts. Claim codes and test logins are in local `docs/CREDENTIALS.md` (not in git).

## Data exports

Circuit tech admins download any data as .xlsx or CSV from **Dashboard → Export data** (`/ops/export`). This needs no setup or Google keys. See [board-guide.md](board-guide.md#exports).

## Optional Google Sheets

The site works without this. For a live per-comp applicant sheet: create a Google Cloud service account, turn on the Sheets API, and share the sheet with that email as Editor. A competition admin pastes the sheet URL on **Comp Details**. The sheet fills automatically when results release and updates whenever the competition changes an application status. It stays empty before release so team names never leak. Drive audition videos do not use these keys — teams paste a public file link.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local site |
| `npm run build` / `npm start` | Production |
| `npm run db:migrate` | Apply migrations to Supabase |
| `npm run db:seed` | Wipe app tables and restore listings |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest), no database needed |
| `npm run test:e2e` | Browser tests (Playwright) against a local Postgres; see [workflows.md](workflows.md#run-the-tests) |
| `npm run db:seed:e2e` | Load browser-test fixtures; refuses any database that is not localhost |
