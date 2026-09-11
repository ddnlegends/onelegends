# Competition claim codes

**Docs:** [README](README.md) · [SETUP](SETUP.md) · [TECH_STACK](TECH_STACK.md) · [SUAV](SUAV.md)

These codes **claim** an official bid listing from **Account** after you log in. Teams already see the competition on Home / Apply. Register with email and password (no role picker), then enter this code on Account. First valid claim becomes the primary admin.

- One code → one listing → first claimer is primary admin
- Already claimed → the form shows “already claimed” plus a blurred admin email
- Primary can invite secondary admins by email (popup on their next login; this app does not send email)
- Do not post these in a public chat
- Codes are stored on `CompetitionProfile.claimCode` in **Supabase** after seed
- Reseeding (`npm run db:seed`) runs against Supabase. It wipes users and applications, then restores these listings as **unclaimed**

Team claim codes are different: only Legends Admin can create a team, which generates a `TEAM-XXXXXX` code to hand to the captain.

| Competition | Claim code |
| --- | --- |
| Legends | `LGND-7K2M` |
| Buckeye Mela | `BCKY-1N4R` |
| ATL Tamasha | `ATL-6J7K` |

Codes live in `prisma/season-comps.ts`. Change them there, update this table, then reseed.
