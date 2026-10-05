# Board and circuit operations guide

This guide is for the Legends board, circuit operations, and incoming officers. See [setup.md](setup.md) for installation and [tech-chair-handoff.md](tech-chair-handoff.md) for code and deployment ownership.

## Who can see what

| Role | Access |
| --- | --- |
| Team admin | Own team profile, roster, invitations, applications, and payment guidance. |
| Competition admin | Own competition settings, aggregate applicant stats, judges, and results. Team names and full rosters are available only for teams that applied to that competition after results release. |
| Judge | Anonymous AV packet and own scores. Never receives named team profiles. |
| Registration staff | Assigned competition's live viewing: anonymous team numbers, each team's AV, and a checkmark per judge per team. Never sees team names. |
| Circuit tech admin | **Teams** and **Competitions** (click a row's arrow to expand every detail, including stage size, lighting, production notes, owners, judges, REG access, and applications), **Comp Dashboard** for live judging, and **Export data** for .xlsx/CSV downloads. |

Access checks run in server pages and actions. Giving someone a claim code or inviting them grants access only after they claim or approve it. Do not share test login credentials as a way to grant a normal role.

## Start of season

1. Tech chair verifies production Google OAuth, Supabase connection, and migration status using [setup.md](setup.md). Confirm board members can sign in with their own Google accounts.
2. Circuit ops creates team listings and competition listings in the admin dashboard. Give each primary contact the correct one-time claim code through your normal secure channel. A Google sign-in alone does not create or claim a team.
3. First-time users must use **Register** (Continue with Google there). **Log In** with a Google account that has no OneLegends account sends them to Register with a notice instead of creating one.
4. Primary team and competition admins claim their listings and invite secondary admins by email. The app shows invitations at login and on the dashboard; it does not send email. Tell invitees to register with the same Google email as the invitation.
5. Teams complete the profile, photo, Drive AV, and roster. A complete profile is required to apply. Ask teams to give the Drive file a neutral name (not the team name), because the title can show when registration shares the video.
6. Competition admins fill dates, venue, production details, application deadline, and required judge count. They invite judges and registration staff. The deadline is entered and shown in each viewer's own timezone, with the zone labeled.

## Payments and eligibility

The Payments page is linked from the home page, team dashboard, and application form. The PayPal link is a **generic placeholder**, not a real recipient. Teams should confirm amount and recipient with circuit ops or the host before sending money, use the memo **`{Team}'s OneLegends Payment`** with their actual team name, and keep a receipt. The app has no checkout, payment webhook, or automatic paid flag. Circuit dues and host application fees may go to different recipients.

Circuit ops may block a team from new applications on its dashboard. Enter a clear reason (for example, unpaid circuit dues or pending paperwork); the reason is saved in Supabase and visible to other circuit admins in their dashboard and **Teams** view. Remove the block after resolving the issue. Existing applications remain. There is **no MOU system connection** and no automatic eligibility check based on a signed MOU. Use the reason field to record the manual decision, without adding private document contents.

## Applications, viewing, and results

Applications can be accepted only while the competition is marked as accepting them, before its deadline and before results release. A team must have a complete profile and no circuit block. Competition admins see applicant counts and aggregate stats while judging is pending; team identities remain sealed.

Close applications before circuit ops opens judging. Opening judging also forces applications closed, and the database prevents both flags being true at once. Judges score anonymous packets. Registration staff coordinate the live AV. Once a team has a place in a viewing order, it cannot change its AV link until that competition releases results; if a video will not play, fix the sharing setting on the same Drive file instead. After the required number of approved judges submit, results release and scores lock. A competition admin can then open **Viewing Results** and **Applied Teams** for names, status decisions, full rosters, AV, dietary restrictions, and shirt sizes. That view contains only teams that applied to the active competition. Circuit tech admins can always inspect all registered teams through **Teams**.

See [judging.md](judging.md) for the scoring rubric and full judging flow. Coordinate any manual change to the required judge count before results release.

## Resetting a claim

Use a reset only when a listing was claimed by the wrong person or its contact has left. It cannot be undone.

- **Team reset** removes every team admin and pending invite, and issues a new claim code. The profile, roster, and applications stay.
- **Competition reset** removes every competition admin and admin invite, judge invite, and REG access, closes judging, and issues a new claim code. Judges are removed too unless results have already been released, so historical scores stay intact.

The new code appears in the confirmation message and on the row in **Teams** or **Competitions**. Send it to the right contact through a secure channel.

## Exports

Circuit tech admins can download data from **Dashboard → Export data**, or from the **Export** link on a competition row to limit the file to that competition.

1. Tick the datasets you need, or use a preset: **Everything** or **Judging pack** (lineups, judges, scores, results).
2. **Download .xlsx** gives one tab per dataset. To use it in Google Sheets, upload it to Drive and open it, or use File → Import.
3. Each dataset card also has a **CSV** link for a single table.

Exports respect the anonymity gate: before a competition releases results, scores list teams as Team 1, Team 2, and so on, and lineups hide the viewing order. Files can contain emails, rosters, dietary restrictions, and claim codes. Keep them in the board's private Drive and do not post them publicly.

## Annual board handoff

1. Transfer ownership of Google Cloud OAuth, Supabase, deployment, domain, and the GitHub repository to the incoming authorized tech chairs through the organization's account process. Store secrets in the deployment secret manager, never in git or a handoff document.
2. Review current circuit admins and remove departing officers' access. Invite new admins using their Google emails and verify their dashboard privileges.
3. Review team and competition admin membership. A primary transfer button is not yet built; use [Resetting a claim](#resetting-a-claim) only when appropriate, because it removes existing membership. Download an **Everything** export as a season archive before making changes.
4. Record which competitions are active for the new season. Automatic partner-by-year archiving is not built, so check old listings manually.
5. Confirm the current payment recipient and replace the placeholder only when the board provides an official link. Review outstanding application blocks and reasons.
6. Use the [tech chair checklist](tech-chair-handoff.md#release-and-handoff-checklist) for changes and deployment.
