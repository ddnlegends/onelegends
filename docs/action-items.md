# Action items

What the board asked for, what is done, and what is still open. The [README](../README.md) describes the product Media and Design can talk about; this list tracks the work behind it. Update it when an item ships or a decision is made.

## Done this season

| Item | Where it lives |
| --- | --- |
| Google sign-in replaces the shared test accounts | **Register** creates an account with Google; **Log In** only works for existing accounts. See [setup.md](setup.md#environment). |
| Accepting applications and judging can no longer both be on | Opening judging closes applications, and a database `CHECK` rejects both flags being true (`prisma/migrations/20261004150000_block_reasons_and_judging_gate`). |
| Tech admins can see every team's full info and roster | **Teams** and **Competitions** pages with expandable rows, plus **Export data** (.xlsx or CSV). See [board-guide.md](board-guide.md#exports). |
| Code lives in the DDN GitHub | `github.com/ddnlegends/onelegends`, deployed from `main`. |
| Live judging dashboard | **Comp Dashboard** shows every judge's scores as they save. |
| Regression tests | Unit tests and browser tests run on every push. See [workflows.md](workflows.md#run-the-tests). |
| Codebase documentation | Module headers in key files, [workflows.md](workflows.md), and [CHANGELOG.md](../CHANGELOG.md). |

## Open

| Item | Owner | Status |
| --- | --- | --- |
| [Payments](#payments) | Board, then tech | Manual Zelle/PayPal address shown; no in-app confirmation |
| [DDN app integration](#ddn-app-integration) | Board and app team | Needs a decision |
| [Branding review](#branding-review) | Sreya and MD | Not started |
| [Regression workflow merge](#regression-workflow-merge) | Rushi and tech | Not started |
| [Test-account passwords](#test-account-passwords) | Tech | Should fix before next season |
| [Transfer primary admin](#transfer-primary-admin) | Tech | Not built |
| [Partner competitions by year](#partner-competitions-by-year) | Tech | Not built |
| [MOU tracking](#mou-tracking) | Board | Nice-to-have |
| [Owner decisions from the audit](#owner-decisions-from-the-audit) | Board | Needs a decision |
| [Cleanup](#cleanup) | Tech | Small |

### Payments

The site does not take money yet. The home, team, apply, and Payments pages explain the manual process. Teams can pay via Zelle or PayPal to `legends@desidancenetwork.org` after confirming the amount and recipient. The memo is `{Team}'s OneLegends Payment`.

For future payment integration, the board would need either an official payment link for each recipient (circuit dues, and each competition's entry fee), or a PayPal Business account with API keys if the app should confirm payments itself.

With the current Zelle or PayPal address, circuit ops still marks dues paid by unblocking the team. A later bank debit or card link could confirm payment in the app. Each competition could keep its own link. Circuit dues stay separate from a host’s application fee.

### DDN app integration

How OneLegends and the DDN app fit together long term is not settled. Options, from least to most work:

1. **Deep links.** The app links to OneLegends pages (apply, results, payments). No shared data.
2. **Shared Google sign-in.** Both use the same Google accounts, so one identity works in both places.
3. **Read-only API.** OneLegends exposes competitions, dates, and released results as JSON for the app to show. Nothing sealed before results release may be exposed.

Decide which the app needs, then add it here as a concrete feature.

### Branding review

Sreya and the MD team should check colors, fonts, logo use, and page layouts against DDN branding. Tech will apply the feedback. Colors and fonts live in `src/app/globals.css`.

### Regression workflow merge

Rushi has been setting up agentic regression testing with Codex. The repo now has its own tests (`npm test`, `npm run test:e2e`, and the GitHub Actions workflow). Compare the two, keep whichever covers more, and fold the other's useful checks in so there is one suite.

### Test-account passwords

`prisma/seed.ts` contains plaintext passwords for the test accounts listed in `src/lib/auth-policy.ts`, and those accounts can still sign in with a password on production. One of them is a tech admin. Before next season, do one of: change those passwords and move them into environment variables, or turn off password sign-in on production entirely.

### Transfer primary admin

Team and competition primary admins can hand primary ownership to another user.

1. The current primary admin invites that person as a secondary admin.
2. The invitee approves, the same way other secondary admins do.
3. The primary admin then transfers primary ownership to that secondary admin.
4. The previous primary admin becomes a secondary admin. One primary remains.
5. The roster, profile, applications, and listing stay on the same team or competition.

Today a primary admin can invite and remove secondary admins only. Removing the primary admin is blocked. Reopening a claim is limited to circuit ops, clears every admin, and issues a new claim code. This feature replaces that path for a normal leadership change.

### Partner competitions by year

A competition that is a partner one year might not be a partner the next. This is for competitions only. Teams stay on the platform. Listings today persist until someone removes them, so a host that sits out a season would still appear.

Circuit ops can now label a listing Partner or Non-partner. That label applies to the whole listing and does not archive it by year.

Find a way to carry a partner competition for the year it belongs to, and leave it off the next season when the partnership does not continue. Applications, judging, and results for the year it ran should stay intact.

### MOU tracking

Blocking a team from applying is a manual decision: circuit ops sets a block with a written reason. Nothing reads a signed-MOU list. If the board wants it later, the simplest step is an "MOU signed" checkbox and date per team that tech admins set, shown in **Teams** and the export, optionally blocking unsigned teams from applying.

### Owner decisions from the audit

These work as built, but the board should confirm each one is intended:

- Team logos load from a public link, so anyone with the URL can see them.
- There is no limit on how many claim codes someone can try.
- Declined applications still get a place in the viewing order.
- The public competition listing shows production details such as stage size and lighting.

### Cleanup

`src/components/SyncSheetButton.tsx` is not used anywhere since the applicant sheet started syncing on its own at results release. Delete it, or put the button back on **Comp Details** if a manual sync is wanted.
