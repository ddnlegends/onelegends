import { Fragment } from "react";
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
  isScoreComplete,
  rubricCell,
  rubricFilledCount,
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
  const live = claimed && competition.judgingOpen;
  const judges = competition.judgeAssignments;
  const submitted = judges.filter((row) => row.submittedAt).length;

  return (
    <div className="space-y-8">
      <AutoRefresh active={live} intervalMs={5000} />
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">
          Circuit ops only
        </p>
        <h1 className="font-heading text-4xl">Live View</h1>
        <p className="mt-2 max-w-3xl text-muted">
          {live
            ? `Every rubric cell for ${competition.name}, every team, every judge. Cells update as soon as a judge picks a score or clicks out.`
            : "Live View opens after judging is open on a claimed competition."}
        </p>
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
              <p className="mt-2 font-heading text-3xl text-accent">
                {judges.length}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-card p-5">
              <p className="text-xs uppercase tracking-wide text-muted">
                Packets in
              </p>
              <p className="mt-2 font-heading text-3xl text-accent">
                {submitted} / {competition.requiredJudgeCount}
              </p>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">Judge packets</h2>
            {judges.length === 0 ? (
              <p className="text-sm text-muted">No judges approved yet.</p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line bg-card">
                {judges.map((row) => {
                  const complete = row.slots.filter((slot) =>
                    isScoreComplete(slot.score),
                  ).length;
                  const started = row.slots.filter(
                    (slot) => rubricFilledCount(slot.score) > 0,
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
                            ? `Live · ${complete} complete · ${started} started / ${total} teams`
                            : "Approved · packet not opened yet"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">Every subscore</h2>
            {competition.applications.length === 0 ? (
              <p className="text-sm text-muted">No applications yet.</p>
            ) : judges.length === 0 ? (
              <p className="text-sm text-muted">
                Invite judges to see live scores here.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-line bg-card">
                <table className="w-full min-w-[56rem] text-left text-sm">
                  <thead className="border-b border-line bg-blush text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th
                        className="sticky left-0 z-10 bg-blush px-4 py-3 font-medium"
                        rowSpan={2}
                      >
                        Team
                      </th>
                      {judges.map((row) => (
                        <th
                          key={row.id}
                          className="px-4 py-3 text-center font-medium"
                          colSpan={RUBRIC_CATEGORIES.length + 2}
                        >
                          {row.judge.name}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {judges.map((row) => (
                        <Fragment key={`${row.id}-cats`}>
                          {RUBRIC_CATEGORIES.map((category) => (
                            <th
                              key={`${row.id}-${category.key}`}
                              className="px-3 py-2 font-medium"
                            >
                              {category.label}
                            </th>
                          ))}
                          <th className="px-3 py-2 font-medium">Total</th>
                          <th className="px-3 py-2 font-medium">Note</th>
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {competition.applications.map((app) => (
                      <tr
                        key={app.id}
                        className="border-b border-line last:border-0 align-top"
                      >
                        <th className="sticky left-0 z-10 bg-card px-4 py-3 text-left font-semibold">
                          {app.team.name}
                        </th>
                        {judges.map((row) => {
                          const slot = row.slots.find(
                            (item) => item.applicationId === app.id,
                          );
                          const score = slot?.score ?? null;
                          const total = rubricTotalOrNull(score);
                          const note = scoreComment(score);
                          return (
                            <Fragment key={`${row.id}-${app.id}`}>
                              {RUBRIC_CATEGORIES.map((category) => (
                                <td
                                  key={`${row.id}-${app.id}-${category.key}`}
                                  className="px-3 py-3 tabular-nums"
                                >
                                  {rubricCell(score?.[category.key])}
                                </td>
                              ))}
                              <td className="px-3 py-3 font-medium tabular-nums">
                                {total != null ? `${total}` : "—"}
                              </td>
                              <td className="max-w-[12rem] px-3 py-3 text-xs text-muted">
                                {note || "—"}
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted">
              This board refreshes every few seconds. Judges stay anonymous to
              each other; you see names because you are circuit ops.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
