# Setup

**OneLegends** — applications for the Legends circuit.

**Docs:** [README](README.md) · [TECH_STACK](TECH_STACK.md) · [SUAV](SUAV.md) · [COMP_CODES](COMP_CODES.md)

You only need **Node 20+** (22 recommended) and **npm**. The database is **hosted Postgres on [Supabase](https://supabase.com/)**. There is no local Postgres, Docker database, or Homebrew Postgres in this project.

This is a Node.js app. The environment is **nvm** (pinned Node) plus `node_modules` from `npm install`. You do not need Python or `python -m venv`.

What each package and service is for: **[TECH_STACK.md](TECH_STACK.md)**.

## 1. Node (nvm)

Install [nvm](https://github.com/nvm-sh/nvm) if you do not have it:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Restart the terminal (or `source ~/.zshrc` / `source ~/.bashrc`), then from the repo root:

```bash
nvm install
nvm use
```

That reads [`.nvmrc`](.nvmrc) and switches this shell to **Node 22**. Confirm:

```bash
node -v
# v22.x.x
```

Every new terminal in this project should run `nvm use` so you stay on the same Node.

**Already have Node 20.9+?** You can skip nvm. `npm install` still keeps packages in this repo’s `node_modules`.

## 2. Install packages

```bash
npm install
cp .env.example .env
```

Change `AUTH_SECRET` before any public deploy (`openssl rand -base64 32`). Keep `.env` out of git.

## 3. Supabase

Prisma talks to Postgres with a **connection URI**. Auth.js is this app’s login. You do **not** need the Supabase Next.js / `anon` API keys.

1. Create a project at [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Open **Project Settings → Database**.
3. Copy the **URI** connections (Connect → **ORMs** / **Prisma**, or **Session + Transaction pooler**).

| Env var | Which URI | Notes |
| --- | --- | --- |
| `DATABASE_URL` | **Transaction pooler** (port **6543**) | App queries. Add `?pgbouncer=true` if it is not already there. |
| `DIRECT_URL` | **Direct** or **Session pooler** (port **5432**) | Prisma migrations. |

Use the `postgres` user and the database password from the project. **URI-encode special characters in the password** or the host will parse wrong. `@` → `%40`, `#` → `%23`, `%` → `%25`.

Example shape (placeholders only — do not commit real passwords):

```
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
```

If the pooler host is not shown yet, the **direct** host also works for local `next dev`:

```
DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require"
DIRECT_URL="postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require"
```

Also set:

| Env var | Used for |
| --- | --- |
| `AUTH_SECRET` | Signs the login cookie |
| `AUTH_URL` | `http://localhost:3000` while developing |

Paste into `.env`. Prisma uses `DIRECT_URL` for `migrate`; the running app uses `DATABASE_URL`.

**Do not run `prisma migrate reset` against Supabase** — it tries to drop the database. To empty app data, run `npm run db:seed` (deletes users, applications, and scores, then restores bid listings).

## 4. Schema + listings

```bash
npx prisma migrate deploy
npm run db:seed
```

That creates the tables in Supabase and leaves **no dance-team logins**. Season listings exist on Home / Apply, **unclaimed**. After you register, claim a competition from Account with a code from **[COMP_CODES.md](COMP_CODES.md)**. Legends Admin (`legendstech@desidancenetwork.org`) is the only login that can create teams and hand out team claim codes.

Anonymous judging is described in [SUAV.md](SUAV.md).

## 5. Run the site

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- Home is the competition list (official bid names) plus **How it works**
- **Register / Log In**: email and password only
- **Account**: claim a team or competition with a code, or approve invites
- **Competition**: bid code → primary admin for that listing
- **Team**: Legends Admin creates the team and gives you a claim code

## 6. Optional Google Sheets

The app works without this. When set up, applying (and the **Sync Google Sheet** button) writes one row per applicant.

1. In Google Cloud, create a project and a **service account**.
2. Enable the **Google Sheets API**.
3. Create a JSON key. Copy `client_email` and `private_key` into `.env`:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL="...@....iam.gserviceaccount.com"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Keep the `\n` characters in the private key as in the JSON file.

4. Create a Google Sheet. Share it with the service account email as **Editor**.
5. As a competition user, paste the sheet URL on **Comp details**.
6. Click **Sync Google Sheet** on the applicants page.

Columns written: Applied At, Team Name, AV Drive Link, Wiki, Photo, Blurb, Captains, Years Established, Roster Size, AV Dancers, Dietary Restrictions, T-Shirt Sizes, Status.

Google Drive AVs do **not** use these keys. Teams paste a public file link; the judge UI embeds it.

## Common issues

**`nvm: command not found`**  
Close and reopen the terminal after installing nvm, or `source ~/.zshrc`. On macOS with Homebrew zsh, the nvm installer adds lines to that file.

**Wrong Node version / odd `npm` errors**  
Run `nvm use` in the repo so you match `.nvmrc`. Need 20.9 or newer.

**`Can't reach database server` / SSL errors**  
Confirm `DATABASE_URL` and `DIRECT_URL` are the Supabase URIs (not `localhost`), the password is URL-encoded, and `sslmode=require` is on the direct host if you use `db.PROJECT.supabase.co`.

**Copied the Next.js / anon key instead of a Postgres URI**  
Those `eyJ…` keys are for supabase-js. This app needs `postgresql://…` URIs. See [TECH_STACK.md](TECH_STACK.md).

**`prepare() can only be used with session pooling or a direct connection`**  
`DATABASE_URL` should be the **transaction** pooler (`6543` + `pgbouncer=true`). `DIRECT_URL` should be session or direct (`5432`).

**Sheets sync error about permissions**  
The sheet must be shared with the service account email, not your personal Gmail.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run db:migrate` | Apply Prisma migrations to Supabase |
| `npm run db:seed` | Wipe app tables and restore unclaimed bid listings on Supabase |
| `npm run lint` | ESLint |
