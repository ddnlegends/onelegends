import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { JudgeScoreForm } from "@/components/JudgeScoreForm";
import { LiveTeamFollower } from "@/components/LiveTeam";
import {
  ensureViewingSlots,
  isJudgingOpen,
  judgingLockMessage,
  viewingNeighbors,
} from "@/lib/judging";

export default async function JudgeTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ competitionId: string; position: string }>;
  searchParams: Promise<{ stay?: string }>;
}) {
  const [{ competitionId, position: positionRaw }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const position = Number(positionRaw);
  if (!Number.isInteger(position) || position < 1) notFound();
  const pinned = query.stay === "1";

  const session = await auth();
  if (!session?.user) redirect("/login");
  const assignment = await prisma.judgeAssignment.findFirst({
    where: {
      competitionId,
      status: "APPROVED",
      judge: { userId: session.user.id },
    },
    include: { competition: true },
  });
  if (!assignment) notFound();

  const scoringOpen = isJudgingOpen(assignment.competition);
  if (scoringOpen) {
    await ensureViewingSlots(assignment.id);
  }

  const slots = await prisma.judgeViewingSlot.findMany({
    where: { assignmentId: assignment.id },
    select: { position: true, score: true },
    orderBy: { position: "asc" },
  });
  if (slots.length === 0) redirect(`/judge/${competitionId}`);
  const slot = slots.find((row) => row.position === position);
  if (!slot) notFound();

  const positions = slots.map((row) => row.position);
  const { index, prev, next } = viewingNeighbors(positions, position);
  const locked = Boolean(assignment.submittedAt) || !scoringOpen;
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
            {index + 1} of {slots.length}. The moderator plays the video on a
            shared screen. Every judge sees the same Team number.
          </p>
        </div>
        <Link href={`/judge/${competitionId}`} prefetch className="btn btn-ghost">
          Packet List
        </Link>
      </div>
      <LiveTeamFollower
        competitionId={competitionId}
        position={position}
        positions={positions}
        pinned={pinned}
        locked={locked}
        submitted={Boolean(assignment.submittedAt)}
        initial={{
          judgingOpen: scoringOpen,
          livePosition: scoringOpen ? assignment.competition.livePosition : null,
        }}
      />
      {lockMessage ? (
        <p className="rounded-xl border border-line bg-blush p-4 text-sm">
          {lockMessage}
        </p>
      ) : null}
      <JudgeScoreForm
        key={`${assignment.id}-${position}`}
        competitionId={competitionId}
        assignmentId={assignment.id}
        position={position}
        prevPosition={prev}
        nextPosition={next}
        saved={slot.score}
        locked={locked}
      />
    </div>
  );
}
