# Role and navigation audit — October 9, 2026

**Result: the normal workflows largely pass, but this audit does not support production sign-off.** Team and competition admins can overwrite the wrong listing by saving a stale form after switching listings in another tab. A judge's rejected score save can also display a misleading saved total. The guide corrections in this PR do not fix those application defects.

## Scope and evidence

- Baseline: main commit `2345d655187b7a5e1899eeab3f8dc54a78b452f3`.
- Five role agents: team, judge, competition admin, circuit admin, and moderator. The coordinating agent inspected the public production entry/login, judge walkthrough, and payment pages.
- Hands-on role tests ran against a production build with isolated, disposable PostgreSQL databases and synthetic accounts. Browser actions used the real app UI. Fixture setup and database verification are identified separately below.
- Production at `https://onelegends.vercel.app` exposes Google sign-in only. The earlier app-password accounts were not used to bypass that boundary. No production applications, scores, permissions, payments, or judging state were changed. The deployed commit was not independently identified.
- Raw role notes, screenshots, and HTML test reports were retained locally as audit artifacts; they contain synthetic data. No credentials are included in this report.

### Automated baseline

| Check | Result |
| --- | --- |
| ESLint and TypeScript | Passed |
| Unit tests | 59 passed |
| PostgreSQL integration tests | 19 passed |
| Browser regression | 70 passed: 35 Chromium + 35 WebKit, no retries needed |
| Hosted-auth boundary | 3 passed; password provider/callback and unsafe sessions rejected in hosted mode |
| Clean database migration | All 21 migrations applied to disposable databases |
| Production build | Passed |

These 151 passing baseline test executions do not cover every workflow. In particular, the existing suite missed the reproduced multi-tab and save-feedback defects. The hosted-auth suite initially could not start because a manual QA server occupied its port; after freeing that port, all three tests passed. That setup conflict was not a product failure. Redirect-related “destination stream closed early” logs were also emitted during successful baseline browser tests.

The instruction/navigation update was rebuilt and checked separately: lint, types and 59 unit tests passed; the expanded full browser suite passed all 74 Chromium/WebKit cases without retries; all 3 hosted-auth cases passed again. The four new browser cases cover the five role tabs, keyboard navigation, 375px layout, public help navigation, and signed-in access back to Dashboard. A final heading-hierarchy adjustment received the focused four-case check again. The application/database logic is unchanged; its 19 integration cases passed on the audited baseline.

## Role coverage

| Role | Verified paths | Boundaries / remaining work |
| --- | --- | --- |
| Visitor / new user | Public home, role tabs, payment instructions, Google-only login; automated anonymous route/export denials | Real Google registration, consent, callback, account switching, and recovery not completed |
| Team primary / secondary | Local login; first claim; single-tab active-team switching; blank-profile blockers; actual PNG logo upload and profile/roster persistence after reload; application from newly completed profile with Pending status; shirt-size application block; payment memo; invite, review-later, dashboard approval, secondary restrictions | Consecutive claim and stale-form defects below; invalid/oversized image rejection, external payment receipt and real AV accessibility not verified |
| Judge | Invite approval/review-later; profile validation/save; waiting gates; five rubric fields including 0 and 10; comment and score persistence; future-team lock; live following; earlier-team review and return; close/reopen; submission/locks; completed packet; unrelated packet 404; dark theme | Manual live/closure transitions were prepared through synthetic DB fixtures. The existing automated test separately exercises ops → moderator → judge → automatic release in the UI. Real video/screenshare and prolonged offline recovery remain unverified |
| Competition admin | Dashboard/page discovery; switching authorized comps; applicant basics before release; sealed results; moderator/judge conflict; pending invite/cancel; secondary invitation; released results and persisted Accepted decision | Manual released state was prepared in the fixture DB; actual automatic release is covered by the baseline browser test. Date editing is covered by baseline E2E; the manual CUA date input did not update its hidden value, so no product defect was inferred from that tool behavior |
| Circuit admin | Dashboard discovery; team/non-partner listing creation and code discovery; moderator conflict rejection and eligible grant/removal; block/reason/unblock; unclaimed/open-app/empty judging prerequisites; open/progress drilldown/close; export filter/presets. Baseline tests also cover ownership removal and CSV/XLSX content | Manual export download completion was blocked by a hanging browser download wait; no downloaded file was claimed. Automated CSV/XLSX parsing passed separately |
| Moderator | Dashboard discovery and assigned list; unassigned page 404; closed-state explanation; ops opens judging; Show/Next/Clear/Back; incomplete-score gate and polling updates; final read-only rankings. Baseline tests also cover non-partner-admin access and revocation | Manual judge completion and release were fixture setup; automatic release is separately exercised by baseline E2E. The fake Drive file cannot verify real playback |

## Reproduced defects requiring follow-up

### QA-01 — P1: stale team forms overwrite a different team

1. Use a primary admin with access to teams A and B.
2. Open A's Team Profile in tab 1 and edit its blurb.
3. In tab 2, choose B under Dashboard → Active team.
4. Return to the unchanged A form and press Save Team Profile.

**Observed:** the app reports success, but B receives A's form values, including its name, captains, and blurb. A remains unchanged. UI and direct database reads confirmed the mismatch. The test restored the synthetic team's details afterward.

**Cause / repair:** [team actions](../src/app/actions/team.ts) resolve the target from the active-team cookie instead of an ID bound to the displayed form. Submit the displayed team ID and authorize membership for that ID, or reject a changed context before writing. Roster and application actions use the same pattern; their cross-tab variants were identified in source but not separately executed.

**Regression needed:** open A, switch another tab to B, save A's profile/roster/application; assert neither an unintended B write nor a misleading success is possible.

### QA-02 — P1: stale competition forms overwrite a different competition

1. Use an admin authorized for competitions A and B.
2. Open A's Comp Details in tab 1 and change venue/event details.
3. Switch the active competition to B in tab 2.
4. Save the old A form.

**Observed:** “Competition details saved” appears; B receives A's event details, venue, application setting, and required judge count. A stays unchanged. The required count changed from 3 to 1 in the synthetic reproduction. This can change operational behavior as well as descriptive text.

**Cause / repair:** [saveCompProfile](../src/app/actions/comp.ts) also selects the target using the shared active cookie. Bind the form to the displayed competition and reauthorize it. Review the separate required-count form for the same issue.

**Regression needed:** verify both competitions' complete persisted state after a stale cross-tab save, including `requiredJudgeCount` and `acceptingApps`.

### QA-03 — P2: failed judge saves still say “Saved total”

Open an editable sheet, revoke its assignment in the isolated fixture database, then change a score. The server correctly rejects the mutation with “Assignment not found,” but the same page shows “Saved total: 38 / 50.” The database still holds the previous 39-point total.

[JudgeScoreForm](../src/components/JudgeScoreForm.tsx) derives that wording from the draft rather than confirmed persistence. Distinguish draft totals from saved totals, keep the failed draft available for retry, and test rejected/offline saves with an assertion against persisted data.

### Other observed issues

| ID | Priority | Reproduction and impact | Suggested follow-up |
| --- | --- | --- | --- |
| QA-04 | P2 | Claim a team, then enter a second valid team code on the same page. The old success remains and the new confirmation never opens; reload makes it work. | Reset the previous claim result when looking up a different code in `AccountForms.tsx`; test two consecutive claims. |
| QA-05 | P2 | An existing primary competition admin previews and approves another unclaimed competition. The entire page becomes a server-error screen. | Catch the unique primary-owner constraint in `claimCompAction`, return an actionable message, and verify neither listing changes. |
| QA-06 | P2 | Edit name/captains/blurb and enter an invalid Drive folder link, then save. The correct validation error appears but all unrelated edits are lost. | Preserve Team Profile draft values when validation fails. |
| QA-07 | P2 | Roster shirt-size selects have no accessible names; repeated Remove buttons do not identify their row. | Add per-dancer labels and distinct removal names; test with keyboard/screen-reader navigation. |
| QA-08 | P3 | The live banner changes to “Score Team 1,” but its packet row still says “Waiting for live video.” | Refresh or derive packet row state when `livePosition` changes. The main banner CTA still works. |
| QA-09 | P3 | With two approved judges and required count 1, one submits and releases results. The other remains in To-Do / “Waiting for judging to open,” though the packet correctly rejects edits. | Show a released/closed state for unsubmitted judges; remove the promise that the packet will appear later. |
| QA-10 | P3 | Released competition results still suggest lowering N to release early; count controls appear editable even though the server rejects changes. | Use released-state wording and disable the immutable controls. |
| QA-11 | P3 | Moderator Clear screen shows “Not started 0%” and “Start with Team 1” even after earlier teams were scored. Eligible team controls still work. | Distinguish paused live selection from completed scoring progress. |
| QA-12 | P3 | After blocking and then unblocking a team, the old block confirmation reappears beside the successful unblock message. Eligibility is correctly restored. | Reset the confirmation state after a successful action or a blocked-state change. |

The full blank-team onboarding follow-up used a real PNG from the repository's public brand assets. It verified the preview, Save Team Profile, persisted logo after reload, separate Save roster, Ready to apply state, successful application, and Pending status. A Chrome file-access restriction prevented the first upload attempt; the existing in-app browser completed it without changing extension permissions. Actual AV playback and image rejection boundaries were not established by this successful upload.

The Team Profile AV help also still says judges watch in-app, despite the moderator-driven design. The homepage is corrected in this PR; that additional form help should be aligned in a follow-up.

Ownership of these follow-ups has not been assigned. QA-01 and QA-02 should be resolved before signing off on multi-listing administration. The homepage advises finishing edits before switching and reloading other open tabs as an interim precaution, not as a substitute for the code fix.

## Source findings needing targeted reproduction

- Application submissions can describe a competition that closed after selection as “already on file.” Verify a mixed open/expired selection at submission time.
- The application-status dropdown ignores a returned server error. Revoke an admin while the results page is open and verify error feedback plus restored selection.
- `saveCompProfile` checks release state before an unconditional update. Exercise a concurrent release and judge-count edit to verify that released configuration cannot change.
- Multi-tab roster/application/required-count variants of QA-01 and QA-02 need their own checks.

These are source findings, not additional observed production failures.

## Homepage changes in this PR

- Correct the judge walkthrough to one shared anonymous order, moderator screen-share, live unlocking, autosave/error checks, and final packet submission.
- Explain Google Create account versus returning Log In, the invited Google email, and Dashboard → Requests. Remove the obsolete Account destination and claims that judges play their own Drive videos.
- Name the separate Save Team Profile and Save roster actions, application confirmation/status, manual payments, and early versus late deadlines.
- Explain automatic results release and the partner/non-partner moderator handoff.
- Add Moderator and Circuit ops walkthroughs, with role-appropriate dashboard destinations.
- Add a How it works navigation link and `/guide` page. Previously signed-in users were redirected away from the homepage and could not revisit its instructions. A new signed-in navigation test exposed that gap during this audit.
- Make all five tabs accessible by arrow keys, Home/End, and narrow-screen layout.

No authorization, schema, scoring, application, or ownership behavior is changed by the instruction update. No database migration is required. The newly reported application defects remain open.

## Acceptance work still required

Use explicitly designated test teams and competitions for a hosted rehearsal. Confirm the invited Google accounts and environment before writing live data. Complete real Google registration/login/logout/account switching; real Drive permission and screen-share playback; real mobile Safari/Chrome and assistive-technology checks; poor-network/reconnect and leaving during saves; simultaneous judges on different devices; remaining invitation/revocation/concurrency cases; and operational recovery. Capacity and backup/restore drills are separate from this functional audit.

Passing local synthetic tests is not evidence that real OAuth, Google Drive, production data, or event capacity works. Do not mark those acceptance items complete from this report.
