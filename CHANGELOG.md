# Changelog

Notable changes to OneLegends, newest first. Add a line under **Unreleased** with every change that alters behavior, data, or setup, then move it under a date when it ships to `main`. Commit hashes point at the change for anyone backtracking an edit (`git show <hash>`).

## Unreleased

- Replace the preset release threshold with the active approved judge panel and explicit admin finalization. Pending judge invitations block finalization; one submitted packet cannot release rankings while others remain active. Legends tech admins can remove judges during viewing, competition admins before viewing, with confirmation and an audit reason. Removed scores are excluded and the final judge's removal pauses viewing. Live averages and provisional result exports stay hidden until finalization. Apply migration `20261008230000_judge_panel_finalization` before deploying.
- Use the supplied Graphik family as the primary site font and Pontiac Inline for display headings, served locally with the app.
- Add an optional Sober Monitor flag alongside Point of Contact on each roster dancer, with full roster and CSV/XLSX export visibility. Existing dancers default to unchecked.
- Replace the public landing page role walkthrough with a season-wide feature overview for teams, hosts, judges, moderators, and Legends staff.
- Align Prisma CLI and client at 6.19.3, update pinned GitHub Actions to Node 24 releases, and group future action updates into one Dependabot PR.
- Refine all five role walkthroughs for shared judge/moderator viewing, separate team saves, invitations, and automatic results release. Add keyboard navigation and a How it works page reachable after login. Record the five-role QA findings and remaining acceptance work in `docs/qa-role-audit-2026-10-09.md`.
- Add an optional Point of Contact flag to each roster dancer, including full roster views and CSV/XLSX exports; existing dancers default to unchecked.
- Restore temporary production password login for four named demonstration roles, with shortcuts on Log In. Other production emails and preview deployments remain password-disabled; the four accounts must already exist with passwords and role access.
- Rewrite the landing page walkthrough for Teams, Judges, Moderators, Competitions, and Circuit ops to match live viewing, applicant visibility, and roster requirements.
- Moderators can view read-only named final rankings for their assigned competition after results release, using the same rank calculation as competition results. Judging remains anonymous until release, and moderator access does not grant roster or decision controls.
- Approved Partner and Non-partner competition admins can see applicant team names, application dates, and dancer counts before results release for manual payment checks. Full profiles, viewing order, scores, and decisions remain gated until release; judges and moderator-only accounts retain anonymous access.
- Remove applicant Google Sheet links, automatic/manual sync, service-account configuration, and stored Sheet fields. Keep tech-admin XLSX/CSV exports, including the Everything preset.
- Unlock judge scoring only through the live team while allowing edits to earlier teams until packet submission. Block moderator progression until all approved judges have completed every earlier team's five rubric scores.
- Rename the judge scoresheet comment label to “Comments on this team’s video” and clarify the matching judge guide text.
- Circuit ops can remove one team or competition admin, including a primary. An approved replacement can become primary, or the listing can be left unclaimed with a rotated claim code while other access and data remain.
- Approved Non-partner competition admins automatically receive moderator controls for their competition. Partner competitions still use assigned moderators; both types keep the same application and judging flow.
- Group Prisma CLI and client dependency updates and defer major upgrades until the app migration is ready.
- Move the theme controls to the fixed top-right corner and use accessible System, Light, and Dark icon buttons.
- Fixed the competition claim race fixture to use an account without an existing competition, and gave browser CI enough time to install WebKit's Linux system dependencies before its regression suite.
- Add system, light, and dark themes with a persistent header selector, cross-tab updates, and themed forms, dialogs, tables, and status indicators. Browser regressions cover preference persistence, pre-hydration styling, blocked storage, and small-screen use.
- Restrict password test logins to opted-in disposable local environments; revoke hosted legacy/credential sessions and require one fresh login for older sessions.
- Guard both seed commands and test migrations, remove seeded passwords and published competition codes, and generate local claim codes.
- Serialize judging writes and release on the competition row; recheck closure during submission and refuse writes that race a completed release.
- Add database and browser permission/state regression, WebKit coverage, hosted-auth tests, dependency audit/release gates, and SDLC/release/capacity documentation.
- Update Sharp within Next's supported dependency range to address its librsvg advisory.
- Patch the Prisma config merger and ExcelJS UUID dependencies with scoped overrides; verify config loading and XLSX round trips. The production dependency audit is clean at review time.
- Limit claim previews and confirmations to 20 requests per account per 15 minutes using PostgreSQL; refuse stale codes rotated during a claim. Apply migration `20261006170000_claim_attempt_limits` before deploying.
- Require Google's verified-email assertion before account lookup; test registration intent and existing-user sign-in. Read and verify sealed/released CSV and XLSX exports in both browsers.

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
