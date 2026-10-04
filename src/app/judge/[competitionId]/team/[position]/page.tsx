import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { JudgeScoreForm } from "@/components/JudgeScoreForm";
import {
  ensureViewingSlots,
  firstIncompletePosition,
  isJudgingOpen,
  judgingLockMessage,
  priorTeamsScored,
} from "@/lib/judging";

export default async function JudgeTeamPage({
  params,
}: {
  params: Promise<{ competitionId: string; position: string }>;
}) {
  const { competitionId, position: positionRaw } = await params;
  const position = Number(positionRaw);
  if (!Number.isInteger(position) || position < 1) notFound();

  const session = await auth();
  if (!session?.user) redirect("/login");
  const assignment = await prisma.judgeAssignment.findFirst({
    where: {
      competitionId,
      status: "APPROVED",
      judge: { userId: session.user.id },
    },
    include: {
      competition: true,
      slots: { include: { score: true } },
    },
  });
  if (!assignment) notFound();

  const scoringOpen = isJudgingOpen(assignment.competition);
  if (scoringOpen && assignment.slots.length === 0) {
    await ensureViewingSlots(assignment.id);
  }
  if (!scoringOpen && assignment.slots.length === 0) {
    redirect(`/judge/${competitionId}`);
  }

  const slots = await prisma.judgeViewingSlot.findMany({
    where: { assignmentId: assignment.id },
    include: {
      score: true,
      application: {
        select: {
          id: true,
          team: { select: { avDriveUrl: true } },
        },
      },
    },
    orderBy: { position: "asc" },
  });
  const slot = slots.find((row) => row.position === position);
  if (!slot) notFound();

  const totalTeams = slots.length;
  const locked = Boolean(assignment.submittedAt) || !scoringOpen;
  if (
    scoringOpen &&
    !assignment.submittedAt &&
    !priorTeamsScored(slots, position)
  ) {
    const fallback = firstIncompletePosition(slots) ?? 1;
    if (fallback !== position) {
      redirect(`/judge/${competitionId}/team/${fallback}`);
    }
  }
  const lockMessage = assignment.submittedAt
    ? "Packet submitted. Scores are locked."
    : judgingLockMessage(assignment.competition);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">
            {assignment.competition.name}
          </p>
          <h1 className="font-heading text-4xl">Team {position}</h1>
          <p className="mt-2 text-sm text-muted">
            {position} of {totalTeams} in your viewing order. The video is the
            team’s current profile AV — if they fix the Drive link, refresh this
            page.
          </p>
        </div>
        <Link href={`/judge/${competitionId}`} prefetch className="btn btn-ghost">
          Packet List
        </Link>
      </div>
      {lockMessage && !assignment.submittedAt ? (
        <p className="rounded-xl border border-line bg-blush p-4 text-sm">
          {lockMessage}
        </p>
      ) : null}
      <JudgeScoreForm
        key={`${assignment.id}-${position}`}
        competitionId={competitionId}
        assignmentId={assignment.id}
        position={position}
        totalTeams={totalTeams}
        avDriveUrl={slot.application.team.avDriveUrl}
        saved={slot.score}
        locked={locked}
      />
    </div>
  );
}
