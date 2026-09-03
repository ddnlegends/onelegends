# Competition claim codes

**Docs:** [README](README.md) · [SETUP](SETUP.md) · [TECH_STACK](TECH_STACK.md) · [SUAV](SUAV.md)

These codes **claim** an official bid listing. Teams already see the competition on Home / Apply. A competition organizer registers as **Competition**, enters this code, and that login is tied to that listing.

- One code → one listing → one account (first valid claim wins)
- Do not post these in a public chat
- Codes are stored on `CompetitionProfile.claimCode` in **Supabase** after seed
- Reseeding (`npm run db:seed`) runs against Supabase. It wipes users and applications, then restores these listings as **unclaimed**

Register flow: Auth.js creates a `User` with role `COMP`, then attaches that user to the matching unclaimed listing. Details: [TECH_STACK.md](TECH_STACK.md).

| Competition | Claim code |
| --- | --- |
| Legends | `LGND-7K2M` |
| Tufaan | `TFAN-9Q4R` |
| Gateway to India | `GTI-3H8P` |
| Aa Dekhen Zara | `ADZ-6N5W` |
| Norman Nachle | `NRMN-2B7C` |
| Aaj Ka Dhamaka | `AKD-8F3Y` |
| Naach Di Cleveland | `NDC-4T9K` |
| Legacy on Broad | `LGBR-5M1X` |
| Jazba | `JZBA-7P6D` |
| Bollywood Berkeley | `BBRK-1Q8H` |
| NJ Naach | `NJN-9C4V` |
| Magic City Maza | `MCM-3R7J` |
| Knoxville Ki Jawaani | `KKJ-6W2S` |
| Tamasha SD | `TMSD-8L5N` |
| Midwest Dhamaka | `MWD-2Y9G` |
| Jhalak | `JHLK-4D8Q` |
| Aaja Nachle | `AJN-7H3B` |
| UGA India Night | `UGA-5K1F` |
| Blacksburg Ki Badmaashi | `BKB-9T6M` |
| Maryland Minza | `MINZ-3P8W` |
| Buckeye Mela | `BCKY-1N4R` |
| Aag Ki Raat | `AKR-8C2Y` |
| ATL Tamasha | `ATL-6J7K` |

Codes live in `prisma/season-comps.ts`. Change them there, update this table, then reseed.
