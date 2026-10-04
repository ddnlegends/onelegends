import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SubmitPacketButton } from "@/components/SubmitPacketButton";
import {
  ensureViewingSlots,
  isJudgingOpen,
  isScoreComplete,
  judgingLockMessage,
  priorTeamsScored,
  rubricFilledCount,
  rubricTotal,
  scoreComment,
} from "@/lib/judging";
import { formatDateTime } from "@/lib/utils";

export default async function JudgePacketPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const assignment = await prisma.judgeAssignment.findFirst({
    where: {
      competitionId,
      status: "APPROVED",
      judge: { userId: session.user.id },
    },
    include: { competition: true, slots: { include: { score: true } } },
  });
  if (!assignment) notFound();

  const scoringOpen = isJudgingOpen(assignment.competition);
  if (scoringOpen && assignment.slots.length === 0) {
    await ensureViewingSlots(assignment.id);
  }

  const fresh = await prisma.judgeAssignment.findUnique({
    where: { id: assignment.id },
    include: {
      competition: true,
      slots: { orderBy: { position: "asc" }, include: { score: true } },
    },
  });
  if (!fresh) notFound();

  const scored = fresh.slots.filter((slot) => isScoreComplete(slot.score)).length;
  const ready = fresh.slots.length > 0 && scored === fresh.slots.length;
  const locked = Boolean(fresh.submittedAt);
  const lockMessage = judgingLockMessage(fresh.competition);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">
          Anonymous packet
        </p>
        <h1 className="font-heading text-4xl">{fresh.competition.name}</h1>
        <p className="mt-2 text-muted">
          Teams are labeled Team 1, Team 2, … in your private random order. The
          server keeps the real mapping. You never see names.
        </p>
        {fresh.decidedAt ? (
          <p className="mt-1 text-sm text-muted">
            Permission accepted {formatDateTime(fresh.decidedAt)}
            {fresh.submittedAt
              ? ` · Submitted ${formatDateTime(fresh.submittedAt)}`
              : ""}
          </p>
        ) : null}
      </div>

      {lockMessage && !locked ? (
        <p className="notice notice-error">{lockMessage}</p>
      ) : null}

      {fresh.slots.length === 0 ? (
        <p className="text-muted">
          {scoringOpen
            ? "No applications are in this packet yet."
            : "Your packet will appear when circuit ops opens judging."}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {fresh.slots.map((slot) => (
              <li
                key={slot.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium">Team {slot.position}</p>
                  <p className="text-sm text-muted">
                    {isScoreComplete(slot.score)
                      ? `Saved · ${rubricTotal(slot.score)} / 50${
                          scoreComment(slot.score) ? " · Note saved" : ""
                        }`
                      : rubricFilledCount(slot.score)
                        ? `Autosaved · ${rubricFilledCount(slot.score)} / 5`
                        : "Not scored"}
                  </p>
                </div>
                {locked ||
                !scoringOpen ||
                priorTeamsScored(fresh.slots, slot.position) ? (
                  <Link
                    href={`/judge/${competitionId}/team/${slot.position}`}
                    prefetch
                    className="btn btn-ghost py-1.5"
                  >
                    {scoringOpen && !locked
                      ? isScoreComplete(slot.score)
                        ? "Edit / Review"
                        : "Score"
                      : "Review"}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost py-1.5"
                    disabled
                    title={`Fill all five scores for Team ${slot.position - 1} first`}
                  >
                    Score
                  </button>
                )}
              </li>
            ))}
          </ul>
          {locked ? (
            <p className="text-sm text-muted">
              Packet submitted. Scores are locked. Ranked names are only shown
              to the competition.
            </p>
          ) : (
            <SubmitPacketButton
              assignmentId={fresh.id}
              ready={ready && scoringOpen}
              closed={!scoringOpen}
            />
          )}
        </>
      )}
    </div>
  );
}
