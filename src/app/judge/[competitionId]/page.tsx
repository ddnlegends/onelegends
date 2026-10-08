import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SubmitPacketButton } from "@/components/SubmitPacketButton";
import { LiveTeamBanner } from "@/components/LiveTeam";
import {
  ensureViewingSlots,
  isJudgingOpen,
  isScoreComplete,
  judgingLockMessage,
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
    include: { competition: true },
  });
  if (!assignment) notFound();

  const scoringOpen = isJudgingOpen(assignment.competition);
  if (scoringOpen) {
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
  const positions = fresh.slots.map((slot) => slot.position);
  const livePosition = scoringOpen ? fresh.competition.livePosition : null;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">
          Anonymous score sheet
        </p>
        <h1 className="font-heading text-4xl">{fresh.competition.name}</h1>
        <p className="mt-2 max-w-2xl text-muted">
          The moderator plays each video on a shared screen. Your sheet follows
          the team on screen, labeled Team 1, Team 2, … in the same order for
          every judge. You never see names.
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

      <LiveTeamBanner
        competitionId={competitionId}
        positions={positions}
        locked={locked}
        initial={{ judgingOpen: scoringOpen, livePosition }}
      />

      {fresh.slots.length === 0 ? (
        <p className="text-muted">
          {scoringOpen
            ? "No applications are in this packet yet."
            : "Your score sheet will appear when circuit ops opens judging."}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-heading text-2xl">All teams</h2>
            <p className="text-sm text-muted">
              {scored} of {fresh.slots.length} fully scored
            </p>
          </div>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {fresh.slots.map((slot) => {
              const isLive = slot.position === livePosition;
              return (
                <li
                  key={slot.id}
                  className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
                    isLive ? "bg-accent/5" : ""
                  }`}
                >
                  <div>
                    <p className="font-medium">
                      Team {slot.position}
                      {isLive ? (
                        <span className="ml-2 rounded-full bg-brand-ember px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white">
                          Live
                        </span>
                      ) : null}
                    </p>
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
                  <Link
                    href={`/judge/${competitionId}/team/${slot.position}${
                      isLive ? "" : "?stay=1"
                    }`}
                    className="btn btn-ghost py-1.5"
                  >
                    {scoringOpen && !locked
                      ? isScoreComplete(slot.score)
                        ? "Edit / Review"
                        : "Score"
                      : "Review"}
                  </Link>
                </li>
              );
            })}
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
