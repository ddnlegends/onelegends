# SUAV — Standardized Unbiased Audition Viewing

**Docs:** [README](README.md) · [SETUP](SETUP.md) · [TECH_STACK](TECH_STACK.md) · [COMP_CODES](COMP_CODES.md)

OneLegends replaces the old SUAV Randomization spreadsheet/Drive pipeline with an in-app blind packet. The goal is the same: **every judge watches the same kind of audition video and scores teams without knowing who they are.**

The previous Python tool (`suav-randomization`) shuffled an Ekta export, copied Google Drive AVs into `{Comp} Team 1.mp4`, and hid the Team Name column. This app does that mapping on the server instead. Judges never receive team names. Competitions only receive names after the viewing is complete.

How packets, scores, and Drive embeds are implemented: **[TECH_STACK.md](TECH_STACK.md)** (`src/lib/judging.ts`, `src/lib/drive.ts`, Prisma models).

## Access

| Who | How they get in |
| --- | --- |
| **Anyone** | One email + password login. You can be on a team and a competition at the same time. |
| **Team** | Legends Admin creates the listing and a claim code. First person to enter the code on Account is primary admin. Primary invites secondary admins by email (popup on login; no mail is sent). |
| **Judge** | A competition types the judge’s email. The judge approves the invite on login / Account. No claim code. Packets stay anonymous: Team 1, Team 2, … in **that judge’s** random order, plus the AV and rubric. No names, no rankings, no other judges’ scores. |
| **Competition** | Claim an official listing with a bid code on Account ([COMP_CODES.md](COMP_CODES.md)). Counts and aggregates while judging is open. After **N** judges submit, the ranked named packet (scores, z-scores, AVs, accept/waitlist/decline). |

## Standardized AV

1. Each team stores **one** Google Drive audition video on Team Profile.
2. A **file** link (`https://drive.google.com/file/d/…`) is required for in-site playback. Share it so anyone with the link can view.
3. Folder links are allowed on the profile but **cannot** play inline (a folder listing would leak file names). Judges get an “open in Drive” fallback.
4. Applying to a competition stores a **reference** to that team, not a frozen copy of the AV or blurb. Judges and comps always read the current Team Profile. If a team fixes a Drive link or photo, open packets pick it up.
5. Applications close on **that competition’s deadline** (and/or when the comp unchecks Accepting Applications). Late apps are rejected. The competition can extend the deadline if they want more time.

There is **no Google Drive API**. The app parses the URL and embeds Drive’s preview player.

## Judge access

1. A competition invites a judge by typing their email (this app does not send email).
2. The judge logs in (or registers) and Approves the invite in the popup / Account.
3. Approved packets show on the judge’s **To-Do** list with the date permission was accepted.
4. After they submit the full packet, it moves to **Completed** with the submit date.

## Blind packet

1. Judging for a judge starts only after applications are closed **for that first open**. The server then snapshots the **applicant list** (who is in the packet) and shuffles it **per judge**. Profile fields and the AV stay live.
2. Judge A’s Team 1 is not Judge B’s Team 1. The database stores `assignment + position → applicationId`. The UI never sends team names to judges.
3. Each slot is scored on the circuit rubric, whole numbers **0–10** only:

   - Choreography (10)
   - Formations (10)
   - Technique (10)
   - Sync & Cleanliness (10)
   - Overall Impression (10)
   - **Total** out of 50

4. Judges can leave a team, score another, and come back until they hit **Submit Judging** on the packet list. They can also leave an optional **comment** for the competition (invalid link, playback issue, etc.). Other judges never see comments, and team names stay hidden from judges.
5. Submit is blocked until every team in that snapshot has saved scores. After submit, that judge’s scores and comments are locked.

If the competition later extends the deadline, judges who already opened a packet keep their snapshot. Judges who have not opened one wait until apps close again, then get the expanded list.

## Reveal (competition only)

1. The competition sets **required judges (N)** on Comp Details or Judges.
2. When **N** approved judges have submitted, named results unlock on **Viewing Results**. Judges still cannot see that table.
3. If fewer judges finish than planned, the competition can **lower N** to the completed count and release.
4. Ranking uses each judge’s **z-score** of totals (so a harsh judge and a generous judge are comparable), then average total as a tie-break.
5. After reveal, the competition sees team names, per-judge rubric cells, totals, z-scores, judge comments, the live AV, and can accept / waitlist / decline.

Until that moment, even the competition login does **not** list which teams applied.

## Tables in Supabase

| Table | Role in SUAV |
| --- | --- |
| `JudgeAssignment` | Request + approve + submit timestamp for one judge at one comp |
| `JudgeViewingSlot` | Blind order: `position` (Team 1…K) maps to an `applicationId` |
| `JudgeScore` | Five rubric integers plus an optional comment for that slot |

Anonymity is a **presentation and access-control** rule. The server always knows which application sits in which slot; judges’ pages simply never receive team names.

## Old SUAV checklist (retired)

The Python script’s Google login, Drive copy, hidden sheet column, and `_viewing_order.txt` are no longer required for a OneLegends viewing. Keep Drive as the video host; randomization, labels, scoring, z-scores, and the reveal gate live in this app.
