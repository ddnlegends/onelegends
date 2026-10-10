# Judging

Every judge watches the same kind of audition and scores without knowing who the team is. Circuit ops controls when scoring is open. Competition admins can see who applied before judging ends, but ranked results and full team details unlock only after every active judge submits and an admin finalizes results.

## Roles

| Who | What they do |
| --- | --- |
| **Teams** | One profile, one Drive audition file, apply to many comps. |
| **Competition admins** | Claim a listing, set details, invite judges, and manage the approved panel before viewing. See applicant names, application dates, and dancer counts for manual payment checks. Finalize after every active judge submits and pending requests are resolved. After release, see rankings, scores, comments, full rosters, and accept / waitlist / decline. |
| **Judges** | Approve an invite and score anonymous teams in the same shuffled order as every other judge. Their sheets follow the team the moderator is showing. |
| **Moderator** | Runs the audition videos and selects the live team. During judging, sees anonymous team numbers, videos, and a checkmark for each judge who has finished each team. After results release, sees a read-only table of named final rankings. Cannot judge that competition. |
| **Circuit ops** | Create teams and listings, open/close judging on a **claimed** comp (apps must be closed first), monitor every subscore in Comp Dashboard, and export data. |

This app does not send email. Invites wait on the person’s next login.

## Packet

1. Ops opens judging. The competition gets one shuffled order shared by the moderator and every approved judge. From then until results release, a team cannot change its AV link; if a video will not play, fix sharing on the same Drive file.
2. The moderator opens the competition from **Live Viewing** on the dashboard and screen-shares the video area. Check that the Drive file title does not identify the team. The moderator presses **Show Team N**, then **Next**; every judge's sheet switches to that anonymous number. The sidebar shows a checkmark when each judge finishes each team. Moving ahead stays blocked until every approved judge has saved all five scores for every earlier team. The moderator can pause or go backward, but pausing does not bypass this check.
3. Rubric, whole numbers 0–10: Choreography, Formations, Technique, Sync & Cleanliness, Overall Impression (50 max). Scores autosave when a judge picks a number or leaves a field; comments save after a short pause and when the sheet switches. Saves land in the order they were made. Comments are optional and only the competition sees them after reveal.
4. A judge can return to an earlier team to edit its scores until submitting the packet. Future teams cannot be scored or opened from the packet list until the moderator shows them. A pinned earlier sheet stays put until the judge returns to the live team.
5. Submit is blocked until every team in that packet has all five scores. After submit, that judge is locked.

Judge and moderator pages refresh on their own when ops opens, pauses, or ends judging, so nobody needs to reload while waiting.

Team 1 refers to the same application for every judge. The UI never sends team names to judges.

## Live View and results

- **Comp Dashboard** (ops only): every rubric cell, total, and note for every team and judge, updating as judges autosave.
- **Viewing Results** (competition): unlocks after every active approved judge submits and a competition or tech admin explicitly finalizes. Rank is average z-score of totals, then average total. Pending judge invitations and requests must first be resolved.
- **Final rankings** (moderator): unlocks at the same release. Shows rank, team name, average total, average z-score, and judge count for the assigned competition. It has no roster, judge notes, or application decision controls.

Circuit ops can close judging only after every active judge has saved all five scores for every team and submitted their packet. Closing locks scoring but does not release rankings; ops can reopen before finalization if needed. Finalizing results ends the live session and locks further scoring and judge roster changes. Judge submissions alone never release results. Before finalization, competition admins may remove a judge before viewing; Legends tech admins may remove one during viewing. Removal requires a reason and confirmation, excludes that judge's scores, and is recorded. Closing then depends on the remaining active judges. Removing the final judge pauses viewing until a replacement is approved. Circuit tech admins can download released data from **Export data**.

Before release, **Applied Teams** lists each applicant's team name, application date, and dancer count for approved admins of the active competition. It does not expose viewing order, AV links, scores, full rosters, or decision controls. A Non-partner admin may also moderate that competition, so they can know applicants' names while operating the anonymous viewing flow. Judge accounts and moderator-only accounts still receive no named applicant list. After release, **Applied Teams** links to full profiles and rosters only for that competition's applicants; circuit tech admins use **Teams** to inspect every registered team.
