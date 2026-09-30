import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CompSwitcher } from "@/components/CompSwitcher";
import { JudgingControls } from "@/components/JudgingControls";
import {
  RUBRIC_CATEGORIES,
  isCompetitionClaimed,
  isCompetitionOpen,
  rubricCell,
  rubricTotalOrNull,
  scoreComment,
} from "@/lib/judging";
import {
  getActiveCompetitionId,
  isPlatformAdmin,
} from "@/lib/team-access";

export default async function LiveViewPage() {
  const session = await auth();
  const userId = session!.user.id;
  if (!(await isPlatformAdmin(userId))) redirect("/comp");

  const competitionId = await getActiveCompetitionId(userId);
  if (!competitionId) return null;

  const openListings = await prisma.competitionProfile.findMany({
    where: { judgingOpen: true, claimedAt: { not: null } },
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
      judgeInvites: { orderBy: { createdAt: "desc" } },
      judgeAssignments: {
        where: { status: { not: "DENIED" } },
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
  const live = claimed && competition.judgingOpen;
  const judges = competition.judgeAssignments;
  const teams = competition.applications;

  return (
    <div className="space-y-8">
      <AutoRefresh active={live} intervalMs={5000} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">
            Circuit ops only
          </p>
          <h1 className="font-heading text-4xl">Live View</h1>
          <p className="mt-2 max-w-3xl text-muted">
            {live
              ? `One score sheet per invited judge for ${competition.name}. Cells update as they pick a number.`
              : "Live View opens after judging is open on a claimed competition."}
          </p>
        </div>
        <Link href="/comp/progress" prefetch className="btn btn-ghost">
          View Progress
        </Link>
      </div>

      <CompSwitcher
        competitions={openListings}
        activeId={
          live ? competition.id : (openListings[0]?.id ?? competition.id)
        }
        alwaysShow={!live}
      />

      <JudgingControls
        competitionId={competition.id}
        judgingOpen={competition.judgingOpen}
        appsOpen={appsOpen}
        claimed={claimed}
      />

      {live ? (
        <div className="space-y-10">
          {competition.judgeInvites.length === 0 && judges.length === 0 ? (
            <p className="text-sm text-muted">No judges invited yet.</p>
          ) : null}

          {competition.judgeInvites.map((invite) => (
            <section key={invite.id} className="space-y-3">
              <div>
                <h2 className="font-heading text-2xl">{invite.email}</h2>
                <p className="text-sm text-muted">
                  Invite sent · waiting to log in
                </p>
              </div>
              <p className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-muted">
                No scores yet.
              </p>
            </section>
          ))}

          {judges.map((row) => {
            const pending = row.status === "PENDING";
            return (
              <section key={row.id} className="space-y-3">
                <div>
                  <h2 className="font-heading text-2xl">{row.judge.name}</h2>
                  <p className="text-sm text-muted">{row.judge.user.email}</p>
                  <p className="mt-1 text-sm">
                    {pending
                      ? "Invite pending"
                      : row.submittedAt
                        ? "Packet submitted"
                        : "Scoring live"}
                  </p>
                </div>
                {pending ? (
                  <p className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-muted">
                    This judge has not accepted yet, so there is no score sheet.
                  </p>
                ) : teams.length === 0 ? (
                  <p className="text-sm text-muted">No applications yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-line bg-card">
                    <table className="w-full min-w-[40rem] text-left text-sm">
                      <thead className="border-b border-line bg-blush text-xs uppercase tracking-wide text-muted">
                        <tr>
                          <th className="px-4 py-3 font-medium">Team</th>
                          {RUBRIC_CATEGORIES.map((category) => (
                            <th key={category.key} className="px-3 py-3 font-medium">
                              {category.label}
                            </th>
                          ))}
                          <th className="px-3 py-3 font-medium">Total</th>
                          <th className="px-3 py-3 font-medium">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teams.map((app) => {
                          const slot = row.slots.find(
                            (item) => item.applicationId === app.id,
                          );
                          const score = slot?.score ?? null;
                          const total = rubricTotalOrNull(score);
                          const note = scoreComment(score);
                          return (
                            <tr
                              key={app.id}
                              className="border-b border-line last:border-0"
                            >
                              <th className="px-4 py-3 text-left font-semibold">
                                {app.team.name}
                              </th>
                              {RUBRIC_CATEGORIES.map((category) => (
                                <td
                                  key={category.key}
                                  className="px-3 py-3 tabular-nums"
                                >
                                  {rubricCell(score?.[category.key])}
                                </td>
                              ))}
                              <td className="px-3 py-3 font-medium tabular-nums">
                                {total != null ? String(total) : "—"}
                              </td>
                              <td className="max-w-[12rem] px-3 py-3 text-xs text-muted">
                                {note || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
          <p className="text-xs text-muted">
            This board refreshes every few seconds. Judges stay anonymous to
            each other; you see names because you are circuit ops.
          </p>
        </div>
      ) : null}
    </div>
  );
}
