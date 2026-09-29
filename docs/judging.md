# Judging

Every judge watches the same kind of audition and scores without knowing who the team is. Circuit ops controls when scoring is open. Competition admins do not see names until the required number of judges have submitted.

## Roles

| Who | What they do |
| --- | --- |
| **Teams** | One profile, one Drive audition file, apply to many comps. |
| **Competition admins** | Claim a listing, set details and required judge count N, invite judges. See counts until results unlock. Then ranked names, scores, comments, and accept / waitlist / decline. |
| **Judges** | Approve an invite, score an anonymous packet (Team 1, Team 2, … in a private random order). |
| **Circuit ops** | Create teams and listings, open/close judging on a **claimed** comp (apps must be closed first), Live View of every subscore. |

This app does not send email. Invites wait on the person’s next login.

## Packet

1. Ops opens judging. Each approved judge gets a shuffled snapshot of who applied. Profile fields and the AV stay live if a team fixes a link.
2. Rubric, whole numbers 0–10: Choreography, Formations, Technique, Sync & Cleanliness, Overall Impression (50 max). Scores autosave when a judge picks a number or leaves a field. Comments are optional and only the competition sees them after reveal.
3. Submit is blocked until every team in that packet has all five scores. After submit, that judge is locked.

Judge A’s Team 1 is not Judge B’s Team 1. The UI never sends team names to judges.

## Live View and results

- **Live View** (ops only, after judging is open): every rubric cell, total, and note for every team and judge, updating as judges autosave.
- **Viewing Results** (competition): unlocks when N invited judges have submitted. Rank is average z-score of totals, then average total. If fewer judges finish, the competition can lower N.

Until that moment, the competition login does not list which teams applied.
