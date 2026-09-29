import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CompSwitcher } from "@/components/CompSwitcher";
import { JudgingControls } from "@/components/JudgingControls";
import {
  isCompetitionClaimed,
  isCompetitionOpen,
  isScoreComplete,
  rubricCell,
  rubricFilledCount,
  rubricTotalOrNull,
  scoreComment,
  RUBRIC_CATEGORIES,
} from "@/lib/judging";
import {
  getActiveCompetitionId,
  isPlatformAdmin,
} from "@/lib/team-access";

export default async function JudgingProgressPage() {
  const session = await auth();
  const userId = session!.user.id;
  if (!(await isPlatformAdmin(userId))) redirect("/comp");

  const competitionId = await getActiveCompetitionId(userId);
  if (!competitionId) return null;

  const claimedListings = await prisma.competitionProfile.findMany({
    where: { claimedAt: { not: null } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    include: {
      applications: {
        include: { team: { select: { id: true, name: true } } },
        orderBy: { team: { name: "asc" } },
      },
      judgeAssignments: {
        where: { status: "APPROVED" },
        include: {
          judge: { select: { name: true, user: { select: { email: true } } } },
          slots: { include: { score: true } },
        },
        orderBy: { judge: { name: "asc" } },
      },
    },
  });
  if (!competition) return null;

  const appsOpen = isCompetitionOpen(competition);
  const claimed = isCompetitionClaimed(competition);
  const judges = competition.judgeAssignments;
  const submitted = judges.filter((row) => row.submittedAt).length;

  return (
    <div className="space-y-8">
      <AutoRefresh active />
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">
          Circuit ops only
        </p>
        <h1 className="font-heading text-4xl">View Progress</h1>
        <p className="mt-2 max-w-2xl text-muted">
          {claimed
            ? `Live scores for ${competition.name}. Competition admins cannot see this page. Names stay sealed for them until every required judge submits.`
            : `${competition.name} has not been claimed yet. Hand out the bid code, then come back here after a PC claims it.`}
        </p>
      </div>

      <CompSwitcher
        competitions={claimedListings}
        activeId={
          claimed ? competition.id : (claimedListings[0]?.id ?? competition.id)
        }
        alwaysShow={!claimed}
      />

      <JudgingControls
        competitionId={competition.id}
        judgingOpen={competition.judgingOpen}
        appsOpen={appsOpen}
        claimed={claimed}
      />

      {claimed ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Teams</p>
          <p className="mt-2 font-heading text-3xl text-accent">
            {competition.applications.length}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Judges</p>
          <p className="mt-2 font-heading text-3xl text-accent">{judges.length}</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Submitted</p>
          <p className="mt-2 font-heading text-3xl text-accent">
            {submitted} / {competition.requiredJudgeCount}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Judges</h2>
        {judges.length === 0 ? (
          <p className="text-sm text-muted">No judges approved yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {judges.map((row) => {
              const scored = row.slots.filter((slot) =>
                isScoreComplete(slot.score),
              ).length;
              const total = row.slots.length;
              return (
                <li key={row.id} className="px-4 py-3">
                  <p className="font-medium">{row.judge.name}</p>
                  <p className="text-sm text-muted">{row.judge.user.email}</p>
                  <p className="mt-1 text-sm">
                    {row.submittedAt
                      ? "Packet submitted"
                      : total
                        ? `In progress · ${scored} / ${total} teams scored`
                        : "Approved · packet not opened yet"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Live scores</h2>
        {competition.applications.length === 0 ? (
          <p className="text-sm text-muted">No applications yet.</p>
        ) : judges.length === 0 ? (
          <p className="text-sm text-muted">Invite judges to see scores here.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-line bg-blush text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Team</th>
                  {judges.map((row) => (
                    <th key={row.id} className="px-4 py-3 font-medium">
                      {row.judge.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {competition.applications.map((app) => (
                  <tr key={app.id} className="border-b border-line last:border-0 align-top">
                    <td className="px-4 py-3 font-semibold">{app.team.name}</td>
                    {judges.map((row) => {
                      const slot = row.slots.find(
                        (item) => item.applicationId === app.id,
                      );
                      const score = slot?.score;
                      const total = rubricTotalOrNull(score);
                      const note = score ? scoreComment(score) : "";
                      const filled = rubricFilledCount(score);
                      return (
                        <td key={`${row.id}-${app.id}`} className="px-4 py-3">
                          {filled ? (
                            <div>
                              <p>
                                {total != null
                                  ? `${total} / 50`
                                  : `${filled} / 5 saved`}
                              </p>
                              <p className="text-xs text-muted">
                                {RUBRIC_CATEGORIES.map((category) =>
                                  rubricCell(score?.[category.key]),
                                ).join("/")}
                              </p>
                              {note ? (
                                <p className="mt-1 text-xs text-muted">{note}</p>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted">
          Cells update as judges save. This page refreshes every 5 seconds while
          judging is open.
          </p>
        </section>
        </>
      ) : null}
    </div>
  );
}
