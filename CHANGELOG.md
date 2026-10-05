# Changelog

Notable changes to OneLegends, newest first. Add a line under **Unreleased** with every change that alters behavior, data, or setup, then move it under a date when it ships to `main`. Commit hashes point at the change for anyone backtracking an edit (`git show <hash>`).

## Unreleased

Nothing yet.

## 2026-10-05: audit fixes, tests, and documentation

**Judging reliability**
- Score saves and packet submits lock the judge's assignment and re-check state inside one transaction, so a save can no longer land after submit and a packet cannot submit with missing scores.
- Results release exactly once even when the last judges submit together; the applicant Google Sheet syncs at that moment. Release moved to `src/lib/release.ts`.
- Score-sheet saves for a team go through one ordered queue, so a quick comment followed by a score change can no longer save out of order.
- Judge and REG pages refresh on their own when judging opens, pauses, or ends, and stop polling once the judge submits.
- A team cannot change its AV link while it sits in an unreleased viewing order.

**Accounts and admin**
- Resetting a team or competition claim issues a new, cryptographically random claim code. A competition reset also clears judge invites, REG access, and (before release) judges.
- Two admins can no longer remove each other at the same moment and leave zero platform admins.
- The applicant Google Sheet refuses to sync before results release.

**Other fixes**
- Competition deadlines are entered and shown in the viewer's own timezone, with the zone labeled.

**Testing and docs**
- Unit tests (Vitest) and browser tests (Playwright) with a localhost-only fixture seed; both run in GitHub Actions on every push and pull request.
- Module headers on key files, `docs/workflows.md`, this changelog, and `docs/action-items.md` (replaces `feature-implementation.md`).
- All docs updated for Google Log In vs Register, anonymous REG, exports, and claim resets.

## 2026-10-05

- `091a2f7` Tech-admin pages check access themselves (a layout-only check had let logged-out visitors receive claim codes and emails). Teams and Competitions became expandable rows with every detail, including stage size, lighting, and production notes.
- `ce90837` Competitions link added to the tech-admin top nav.
- `bf7d879` Tech-admin data export: pick datasets and download one .xlsx workbook or a single-table CSV.
- `4ef8be2` REG live viewing is anonymous (Team numbers and per-judge checkmarks only); the separate presentation tab was removed. Tech-admin management split into Teams and Competitions pages.
- `952a14c` Google Log In only signs in existing accounts; new users must Register. Tech-admin dashboard redesign.

## 2026-10-04

- `f15e7f6` Payments instructions page, circuit-admin Teams view with full team details, competition Applied Teams after release, and the Google-first login form.
- `74d63c5` Live judging and registration: one shared viewing order, REG drives the team on screen, judges' sheets follow.
- `4a769ae` Optional Google sign-in and tech-admin invites; README describes OneLegends for the circuit.

## 2026-09-29

- `59ad63f` Partial judge scores survive autosave; ops Live View split from progress.
- `1668932` Asynchronous judging restored with ops Live View and faster navigation.

## 2026-09-22

- `e2a6421` Judging stays locked until applications close; fewer database queries per page.
- `c21ecc0` Commit author fixed so Vercel deploys.
- `e90f936` First live viewing session: competition viewing page, live controls, competition switcher, and judge sheet updates.

## 2026-09-11

- `4a2acac` Circuit ops can create competitions with bid codes.
- `c926474` Active team dropdown stays in sync after switching.
- `31c802f` Circuit ops can block a team from applying; claim codes shown on the team list.
- `890ae19` Team photos stored in the database instead of local disk.
- `93dfa33` Team memberships, admin invites, profile forms, and team photos.

## 2026-09-02

- `5521218` First version: team profiles, competition listings, applications, anonymous judge packets, and results.
- `76b07dd` Next.js scaffold.
