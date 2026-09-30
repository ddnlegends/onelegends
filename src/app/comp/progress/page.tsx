import Link from "next/link";
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
  rubricFilledCount,
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
      applications: { select: { id: true } },
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
  const judges = competition.judgeAssignments;
  const submitted = judges.filter((row) => row.submittedAt).length;
  const live = claimed && competition.judgingOpen;

  return (
    <div className="space-y-8">
      <AutoRefresh active />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">
            Circuit ops only
          </p>
          <h1 className="font-heading text-4xl">View Progress</h1>
          <p className="mt-2 max-w-2xl text-muted">
            {claimed
              ? `Summary for ${competition.name}: who is invited, who is scoring, and how many packets are in. Open Live View for every cell.`
              : `${competition.name} has not been claimed yet. Hand out the bid code, then come back here after a PC claims it.`}
          </p>
        </div>
        {live ? (
          <Link href="/comp/live" prefetch className="btn btn-primary">
            Live View
          </Link>
        ) : null}
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
        showLiveLink={live}
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
              <p className="text-xs uppercase tracking-wide text-muted">
                Invited judges
              </p>
              <p className="mt-2 font-heading text-3xl text-accent">
                {judges.length + competition.judgeInvites.length}
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
            <h2 className="font-heading text-2xl">Judges</h2>
            {judges.length === 0 && competition.judgeInvites.length === 0 ? (
              <p className="text-sm text-muted">No judges invited yet.</p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line bg-card">
                {competition.judgeInvites.map((invite) => (
                  <li key={invite.id} className="px-4 py-3">
                    <p className="font-medium">{invite.email}</p>
                    <p className="mt-1 text-sm text-muted">
                      Invite sent · waiting to log in
                    </p>
                  </li>
                ))}
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
                        {row.status === "PENDING"
                          ? "Invite pending"
                          : row.submittedAt
                            ? "Packet submitted"
                            : total
                              ? `${complete} complete · ${started} started / ${total} teams`
                              : "Approved · packet not opened yet"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
