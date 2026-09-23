import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { JudgeScoreForm } from "@/components/JudgeScoreForm";
import { LiveSessionPoll } from "@/components/LiveSessionPoll";
import { ensureViewingSlots, isCompetitionOpen } from "@/lib/judging";

export default async function JudgeTeamPage({
  params,
}: {
  params: Promise<{ competitionId: string; position: string }>;
}) {
  const { competitionId, position: positionRaw } = await params;
  const position = Number(positionRaw);
  if (!Number.isInteger(position) || position < 1) notFound();

  const session = await auth();
  const assignment = await prisma.judgeAssignment.findFirst({
    where: {
      competitionId,
      status: "APPROVED",
      judge: { userId: session!.user.id },
    },
    include: {
      competition: true,
      slots: { include: { score: true } },
    },
  });
  if (!assignment) notFound();

  const live = assignment.competition.judgingMode === "LIVE";
  const livePosition = assignment.competition.livePosition;
  if (live) {
    await ensureViewingSlots(assignment.id);
  } else if (
    !isCompetitionOpen(assignment.competition) &&
    assignment.slots.length === 0
  ) {
    await ensureViewingSlots(assignment.id);
  }
  if (live && !assignment.submittedAt) {
    if (!livePosition) redirect(`/judge/${competitionId}`);
    if (position !== livePosition) {
      redirect(`/judge/${competitionId}/team/${livePosition}`);
    }
  }

  const slot = await prisma.judgeViewingSlot.findUnique({
    where: {
      assignmentId_position: { assignmentId: assignment.id, position },
    },
    include: {
      score: true,
      application: {
        select: {
          id: true,
          team: { select: { avDriveUrl: true } },
        },
      },
    },
  });
  if (!slot) notFound();

  const totalTeams = await prisma.judgeViewingSlot.count({
    where: { assignmentId: assignment.id },
  });

  return (
    <div className="space-y-6">
      {live ? <LiveSessionPoll active /> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">
            {assignment.competition.name}
          </p>
          <h1 className="font-heading text-4xl">Team {position}</h1>
          <p className="mt-2 text-sm text-muted">
            {live
              ? `${position} of ${totalTeams}. Watch Zoom, then save this scoresheet.`
              : `${position} of ${totalTeams} in your viewing order. The video is the team’s current profile AV — if they fix the Drive link, refresh this page.`}
          </p>
        </div>
        {live ? null : (
          <Link href={`/judge/${competitionId}`} className="btn btn-ghost">
            Packet List
          </Link>
        )}
      </div>
      <JudgeScoreForm
        key={`${assignment.id}-${position}`}
        competitionId={competitionId}
        assignmentId={assignment.id}
        position={position}
        totalTeams={totalTeams}
        avDriveUrl={slot.application.team.avDriveUrl}
        saved={slot.score}
        locked={Boolean(assignment.submittedAt)}
        live={live}
      />
    </div>
  );
}
