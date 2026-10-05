# Judging

Every judge watches the same kind of audition and scores without knowing who the team is. Circuit ops controls when scoring is open. Competition admins do not see names until the required number of judges have submitted.

## Roles

| Who | What they do |
| --- | --- |
| **Teams** | One profile, one Drive audition file, apply to many comps. |
| **Competition admins** | Claim a listing, set details and required judge count N, invite judges. See counts until results unlock. Then ranked names, scores, comments, and accept / waitlist / decline. |
| **Judges** | Approve an invite and score anonymous teams in the same shuffled order as every other judge. Their sheets follow the team REG is showing. |
| **Registration (REG)** | Run the audition videos and select the live team. REG sees team numbers, videos, and a checkmark for each judge who has finished each team. REG never sees team names and cannot judge that competition. |
| **Circuit ops** | Create teams and listings, open/close judging on a **claimed** comp (apps must be closed first), monitor every subscore in Comp Dashboard, and export data. |

This app does not send email. Invites wait on the person’s next login.

## Packet

1. Ops opens judging. The competition gets one shuffled order shared by REG and every approved judge. From then until results release, a team cannot change its AV link; if a video will not play, fix sharing on the same Drive file.
2. REG opens the competition from **Live Viewing** on the dashboard and screen-shares the video area. Check that the Drive file title does not identify the team. REG presses **Show Team N**, then **Next**; every judge's sheet switches to that anonymous number. The sidebar shows a checkmark when each judge finishes each team.
3. Rubric, whole numbers 0–10: Choreography, Formations, Technique, Sync & Cleanliness, Overall Impression (50 max). Scores autosave when a judge picks a number or leaves a field; comments save after a short pause and when the sheet switches. Saves land in the order they were made. Comments are optional and only the competition sees them after reveal.
4. A judge can open another team to fix a score. That sheet stays put until they return to the live team.
5. Submit is blocked until every team in that packet has all five scores. After submit, that judge is locked.

Judge and REG pages refresh on their own when ops opens, pauses, or ends judging, so nobody needs to reload while waiting.

Team 1 refers to the same application for every judge. The UI never sends team names to judges.

## Live View and results

- **Comp Dashboard** (ops only): every rubric cell, total, and note for every team and judge, updating as judges autosave.
- **Viewing Results** (competition): unlocks when N invited judges have submitted. Rank is average z-score of totals, then average total. If fewer judges finish, the competition can lower N.

Releasing results ends the live session and locks further scoring. It happens exactly once, even if the last judges submit at the same moment. Applications and the required judge count cannot change after release. If the competition set an applicant Google Sheet, it fills at release and updates when the competition changes an application status. It stays empty before release.

Until that moment, the competition login does not list which teams applied. After release, **Applied Teams** shows full profiles and rosters only for that competition's applicants; circuit tech admins use **Teams** to inspect every registered team.
