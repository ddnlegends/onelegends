# Setup

Node 20.9+ (22 in `.nvmrc`) and npm. The database is hosted Postgres on [Supabase](https://supabase.com/). There is no local database.

```bash
nvm use          # or any Node 20.9+
npm install
cp .env.example .env
```

Change `AUTH_SECRET` before a public deploy (`openssl rand -base64 32`). Keep `.env` out of git.

## Environment

Login is this app’s Auth.js, not Supabase Auth. You need Postgres URIs, not the Next.js / anon `eyJ…` keys.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | App queries. Transaction pooler, port **6543**, with `pgbouncer=true`. |
| `DIRECT_URL` | yes | Migrations. Direct or session pooler, port **5432**. |
| `AUTH_SECRET` | yes | Signs the login cookie. |
| `AUTH_URL` | yes | Site origin (`http://localhost:3000` locally). |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | no | Optional applicant Sheet export. |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | no | Optional Sheet export. Keep `\n` as in the JSON key. |

URI-encode special characters in the database password (`@` → `%40`).

Do not run `prisma migrate reset` against Supabase. To empty app data, run `npm run db:seed` (wipes users and applications, then restores unclaimed listings).

## Database and run

```bash
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Seed creates listings and the Legends Admin login. It does not create dance-team accounts. Claim codes and test logins are in local `docs/CREDENTIALS.md` (not in git).

## Optional Google Sheets

The site works without this. For a per-comp applicant export: Google Cloud service account, Sheets API on, share the sheet with that email as Editor, paste the sheet URL on Comp details, then **Sync Google Sheet**. Drive audition videos do not use these keys — teams paste a public file link.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local site |
| `npm run build` / `npm start` | Production |
| `npm run db:migrate` | Apply migrations to Supabase |
| `npm run db:seed` | Wipe app tables and restore listings |
| `npm run lint` | ESLint |
