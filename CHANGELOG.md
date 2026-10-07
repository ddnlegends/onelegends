# Changelog

Notable changes to OneLegends, newest first. Add a line under **Unreleased** with every change that alters behavior, data, or setup, then move it under a date when it ships to `main`. Commit hashes point at the change for anyone backtracking an edit (`git show <hash>`).

## Unreleased

- Competition details now include an optional early application deadline and a late deadline. The previous application deadline remains the late cutoff; both appear in public, team, and ops views and exports.
- Team image labels now say logo throughout the site and applicant sheet; upload and display behavior is unchanged. Competitions now have Partner and Non-partner labels in public, team, and ops lists. Circuit ops chooses the type when creating a listing and can change it later; existing listings default to Partner.
- Standardized partner competition claim-code wording throughout the site and updated existing competition descriptions.
- Replaced the placeholder PayPal link on the application form and Payments page with Zelle or PayPal instructions for `legends@desidancenetwork.org`.
- Renamed the live viewing role to Moderator across the site, access controls, exports, and documentation. Existing assignments remain in place.
- Performance pass with no behavior changes:
  - Auto-refresh (moderator and ops live pages) and the judge live poll pause while the tab is hidden or the phone is locked, and catch up immediately when it is visible again (`usePollWhileVisible`).
  - Links no longer force a full background render of their target page; they prefetch the loading skeleton (the Next default). The judge's previous/next and live-team links keep full prefetch.
  - Indexes on `Dancer.teamId`, `JudgeScore.assignmentId`, and `JudgeViewingSlot.applicationId` (migration `20261005230000_foreign_key_indexes`).
  - Prisma no longer ships to the browser: pure judging helpers moved to `src/lib/judging-rules.ts` (re-exported from `judging.ts`), photo helpers to `team-photo-rules.ts`.
  - The applicant sheet sync checks release and sheet ID before loading every team and dancer, and reuses one Google client.
  - `/api/live` answers each judge poll in one parallel round of queries instead of three sequential ones.
  - Header and landing crown served from resized copies (21 KB and 142 KB instead of 249 KB); team logos load lazily.
- Fixed a flaky browser test that matched two "Team Profile" links on the dashboard.

## 2026-10-05: Google account chooser

- Google sign-in now shows the account chooser every time (`prompt=select_account`), so you can switch Google accounts after logging out instead of being signed straight back in to the previous one. (`56a1f99`)

## 2026-10-05: audit fixes, tests, and documentation

**Judging reliability**
- Score saves and packet submits lock the judge's assignment and re-check state inside one transaction, so a save can no longer land after submit and a packet cannot submit with missing scores.
- Results release exactly once even when the last judges submit together; the applicant Google Sheet syncs at that moment. Release moved to `src/lib/release.ts`.
- Score-sheet saves for a team go through one ordered queue, so a quick comment followed by a score change can no longer save out of order.
- Judge and moderator pages refresh on their own when judging opens, pauses, or ends, and stop polling once the judge submits.
- A team cannot change its AV link while it sits in an unreleased viewing order.

**Accounts and admin**
- Resetting a team or competition claim issues a new, cryptographically random claim code. A competition reset also clears judge invites, moderator access, and (before release) judges.
- Two admins can no longer remove each other at the same moment and leave zero platform admins.
- The applicant Google Sheet refuses to sync before results release.

**Other fixes**
- Competition deadlines are entered and shown in the viewer's own timezone, with the zone labeled.

**Testing and docs**
- Unit tests (Vitest) and browser tests (Playwright) with a localhost-only fixture seed; both run in GitHub Actions on every push and pull request.
- Module headers on key files, `docs/workflows.md`, this changelog, and `docs/action-items.md` (replaces `feature-implementation.md`).
- All docs updated for Google Log In vs Register, anonymous moderator viewing, exports, and claim resets.

## 2026-10-05

- `091a2f7` Tech-admin pages check access themselves (a layout-only check had let logged-out visitors receive claim codes and emails). Teams and Competitions became expandable rows with every detail, including stage size, lighting, and production notes.
- `ce90837` Competitions link added to the tech-admin top nav.
- `bf7d879` Tech-admin data export: pick datasets and download one .xlsx workbook or a single-table CSV.
- `4ef8be2` Moderator live viewing is anonymous (Team numbers and per-judge checkmarks only); the separate presentation tab was removed. Tech-admin management split into Teams and Competitions pages.
- `952a14c` Google Log In only signs in existing accounts; new users must Register. Tech-admin dashboard redesign.

## 2026-10-04

- `f15e7f6` Payments instructions page, circuit-admin Teams view with full team details, competition Applied Teams after release, and the Google-first login form.
- `74d63c5` Live judging and moderation: one shared viewing order, the moderator drives the team on screen, and judges' sheets follow.
- `4a769ae` Optional Google sign-in and tech-admin invites; README describes OneLegends for the circuit.

## 2026-09-29

- `59ad63f` Partial judge scores survive autosave; ops Live View split from progress.
- `1668932` Asynchronous judging restored with ops Live View and faster navigation.

## 2026-09-22

- `e2a6421` Judging stays locked until applications close; fewer database queries per page.
- `c21ecc0` Commit author fixed so Vercel deploys.
- `e90f936` First live viewing session: competition viewing page, live controls, competition switcher, and judge sheet updates.

## 2026-09-11

- `4a2acac` Circuit ops can create competitions with partner codes.
- `c926474` Active team dropdown stays in sync after switching.
- `31c802f` Circuit ops can block a team from applying; claim codes shown on the team list.
- `890ae19` Team logos stored in the database instead of local disk.
- `93dfa33` Team memberships, admin invites, profile forms, and team logos.

## 2026-09-02

- `5521218` First version: team profiles, competition listings, applications, anonymous judge packets, and results.
- `76b07dd` Next.js scaffold.
