# Board and circuit operations guide

This guide is for the Legends board, circuit operations, and incoming officers. See [setup.md](setup.md) for installation and [tech-chair-handoff.md](tech-chair-handoff.md) for code and deployment ownership.

## Who can see what

| Role | Access |
| --- | --- |
| Team admin | Own team profile, roster, invitations, applications, and payment guidance. |
| Competition admin | Own competition settings, aggregate applicant stats, judges, and results. Team names and full rosters are available only for teams that applied to that competition after results release. |
| Judge | Anonymous AV packet and own scores. Never receives named team profiles. |
| Registration staff | Assigned competition's live viewing controls and names needed to run the event. |
| Circuit tech admin | All registered teams and their full rosters in **Teams**; all competitions, judging state, block reasons, and administrator controls. |

Access checks run in server pages and actions. Giving someone a claim code or inviting them grants access only after they claim or approve it. Do not share test login credentials as a way to grant a normal role.

## Start of season

1. Tech chair verifies production Google OAuth, Supabase connection, and migration status using [setup.md](setup.md). Confirm board members can sign in with their own Google accounts.
2. Circuit ops creates team listings and competition listings in the admin dashboard. Give each primary contact the correct one-time claim code through your normal secure channel. A Google sign-in alone does not create or claim a team.
3. Primary team and competition admins claim their listings and invite secondary admins by email. The app shows invitations at login and on the dashboard; it does not send email. Tell invitees to use the same Google email as the invitation.
4. Teams complete the profile, photo, Drive AV, and roster. A complete profile is required to apply.
5. Competition admins fill dates, venue, production details, application deadline, and required judge count. They invite judges and registration staff.

## Payments and eligibility

The Payments page is linked from the home page, team dashboard, and application form. The PayPal link is a **generic placeholder**, not a real recipient. Teams should confirm amount and recipient with circuit ops or the host before sending money, use the memo **`{Team}'s OneLegends Payment`** with their actual team name, and keep a receipt. The app has no checkout, payment webhook, or automatic paid flag. Circuit dues and host application fees may go to different recipients.

Circuit ops may block a team from new applications on its dashboard. Enter a clear reason (for example, unpaid circuit dues or pending paperwork); the reason is saved in Supabase and visible to other circuit admins in their dashboard and **Teams** view. Remove the block after resolving the issue. Existing applications remain. There is **no MOU system connection** and no automatic eligibility check based on a signed MOU. Use the reason field to record the manual decision, without adding private document contents.

## Applications, viewing, and results

Applications can be accepted only while the competition is marked as accepting them, before its deadline and before results release. A team must have a complete profile and no circuit block. Competition admins see applicant counts and aggregate stats while judging is pending; team identities remain sealed.

Close applications before circuit ops opens judging. Opening judging also forces applications closed, and the database prevents both flags being true at once. Judges score anonymous packets. Registration staff coordinate the live AV. After the required number of approved judges submit, results release and scores lock. A competition admin can then open **Viewing Results** and **Applied Teams** for names, status decisions, full rosters, AV, dietary restrictions, and shirt sizes. That view contains only teams that applied to the active competition. Circuit tech admins can always inspect all registered teams through **Teams**.

See [judging.md](judging.md) for the scoring rubric and full judging flow. Coordinate any manual change to the required judge count before results release.

## Annual board handoff

1. Transfer ownership of Google Cloud OAuth, Supabase, deployment, domain, and the GitHub repository to the incoming authorized tech chairs through the organization's account process. Store secrets in the deployment secret manager, never in git or a handoff document.
2. Review current circuit admins and remove departing officers' access. Invite new admins using their Google emails and verify their dashboard privileges.
3. Review team and competition admin membership. A primary transfer button is not yet built; follow the documented circuit ops process for resetting a claim only when appropriate, because it removes existing membership. Keep historical data backed up.
4. Record which competitions are active for the new season. Automatic partner-by-year archiving is not built, so check old listings manually.
5. Confirm the current payment recipient and replace the placeholder only when the board provides an official link. Review outstanding application blocks and reasons.
6. Use the [tech chair checklist](tech-chair-handoff.md#release-and-handoff-checklist) for changes and deployment.
