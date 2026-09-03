# OneLegends

Brand new applications for the **Legends** circuit. Teams keep one team profile and apply to many competitions with checkboxes. Competitions post tech details and see application **counts and stats only** until standardized anonymous judging is complete. Payment is not in this product.

Branding, color, and type follow [Legends Dance Championship](https://legends.desidancenetwork.org/) — white field, plum/purple/ember accents, Montserrat.

## Documentation

| Doc | What’s in it |
| --- | --- |
| **[SETUP.md](SETUP.md)** | Install Node, connect **Supabase**, migrate, seed, run the site, optional Sheets |
| **[TECH_STACK.md](TECH_STACK.md)** | Every library and service, and what job it does (Auth.js, Prisma, bcrypt, Zod, …) |
| **[SUAV.md](SUAV.md)** | Blind judging: AV rules, packets, rubric, z-scores, when names are revealed |
| **[COMP_CODES.md](COMP_CODES.md)** | Bid claim codes (one code → one listing → one competition login) |

## What each part does

| Piece | Role |
| --- | --- |
| **Next.js (App Router)** | Pages, login, team / comp / judge dashboards, server actions |
| **Supabase (Postgres)** | The **only** database — hosted, not local |
| **Prisma** | Schema, migrations, queries (SQL translator) |
| **Auth.js** | Email/password login with roles `TEAM`, `COMP`, `JUDGE` (not Supabase Auth) |
| **Google Sheets (optional)** | Per-comp export of applicant rows |
| **Google Drive** | Teams host the AV; the app embeds a file link (no Drive API) |

Full explanations: **[TECH_STACK.md](TECH_STACK.md)**.

## Features

- Landing for OneLegends (crown + wordmark)
- Public list of all competitions (dates, city, venue, stage, open/closed)
- Team and judge self-register; competitions **claim** an official listing with a bid code
- Team profile + dancer roster + one standardized AV Drive link
- One apply screen: check comps, submit once; each comp sets its own deadline
- Comp details: dates, location, venue, stage size, lighting, production notes, deadline, required judge count (listing name is locked)
- Comp login shows application volume and aggregate stats (no team names) until judging completes
- Judges request access; comps approve each judge; blind rubric scoring in-app
- After N judges submit, comps see ranked names, scores, and z-scores
- Optional per-comp Google Sheet export

Seed restores listings only (no demo logins). Register a team or judge, or claim a competition with a code from [COMP_CODES.md](COMP_CODES.md).

## Setup

Follow **[SETUP.md](SETUP.md)**. Node via nvm, **Supabase** pooler URLs in `.env` (no local Postgres), then migrate and seed.
