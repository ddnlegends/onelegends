import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CompStatusPill } from "@/components/CompStatusPill";
import { LiveProgress } from "@/components/LiveProgress";
import { ModeratorLiveConsole } from "@/components/ModeratorLiveConsole";
import {
  competitionStatus,
  ensureSharedViewingOrder,
  isJudgingOpen,
  isScoreComplete,
  judgingLockMessage,
} from "@/lib/judging";
import { hasModeratorAccess } from "@/lib/moderator";
import { viewingEligibleApplicationWhere } from "@/lib/payment-eligibility";
import { moderatorResultsReady } from "@/lib/judge-panel-completion";
import { submittedApplicationAvUrl } from "@/lib/application-av";

export default async function ModeratorCompetitionPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(await hasModeratorAccess(session.user.id, competitionId))) notFound();

  const base = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
  });
  if (!base) notFound();
  const open = isJudgingOpen(base);
  if (open) await ensureSharedViewingOrder(competitionId);

  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    include: {
      applications: {
        where: { viewingPosition: { not: null }, ...viewingEligibleApplicationWhere },
        orderBy: { viewingPosition: "asc" },
        select: {
          id: true,
          viewingPosition: true,
          submittedAvDriveUrl: true,
          team: { select: { avDriveUrl: true } },
        },
      },
      judgeInvites: { select: { id: true } },
      judgeAssignments: {
        where: { status: { in: ["APPROVED", "PENDING"] } },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          judge: { select: { name: true } },
          slots: { where: { application: viewingEligibleApplicationWhere }, select: { applicationId: true, score: true } },
        },
      },
    },
  });
  if (!competition) notFound();

  const activeJudges = competition.judgeAssignments.filter(
    (assignment) => assignment.status === "APPROVED",
  );
  const unresolvedJudges = competition.judgeInvites.length +
    competition.judgeAssignments.filter((assignment) => assignment.status === "PENDING").length;
  const resultsReady = moderatorResultsReady(
    competition.applications,
    activeJudges,
    unresolvedJudges,
  );
  const canSeeResults = Boolean(competition.resultsReleasedAt) && resultsReady;
  const status = competitionStatus(competition);
  const teams = competition.applications.map((app) => ({
    position: app.viewingPosition as number,
    avDriveUrl: submittedApplicationAvUrl(app),
    judges: activeJudges.map((assignment) => ({
      id: assignment.id,
      name: assignment.judge.name,
      complete: isScoreComplete(
        assignment.slots.find((slot) => slot.applicationId === app.id)?.score,
      ),
    })),
  }));
  const livePosition = open ? competition.livePosition : null;
  const lockMessage = judgingLockMessage(competition);

  return (
    <div className="space-y-8">
      <AutoRefresh active={!canSeeResults} intervalMs={6000} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Link href="/moderator" className="text-sm text-muted underline">
            All competitions
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-4xl">{competition.name}</h1>
            <CompStatusPill status={status} />
          </div>
          <p className="max-w-2xl text-sm text-muted">
            Teams stay anonymous while judging is open. Rankings unlock for
            moderators after every active judge submits a complete packet and results are released.
          </p>
        </div>
        {open && canSeeResults ? (
          <Link
            href={`/moderator/${competitionId}/results`}
            className="btn btn-primary"
          >
            View final rankings
          </Link>
        ) : open && teams.length ? (
          <div className="w-full max-w-xs">
            <LiveProgress current={livePosition} total={teams.length} />
          </div>
        ) : null}
      </div>

      {resultsReady && !canSeeResults ? (
        <div className="rounded-xl border border-line bg-blush p-6">
          <h2 className="font-heading text-2xl">Thank you for moderating</h2>
          <p className="mt-2 text-sm text-muted">Every active judge has submitted. Results will appear after the circuit tech admin releases them.</p>
        </div>
      ) : !open ? (
        <div className="rounded-xl border border-line bg-blush p-6">
          <p className="font-medium">
            {competition.resultsReleasedAt
              ? "Judging is complete for this competition."
              : "Live viewing is not open yet."}
          </p>
          <p className="mt-1 text-sm text-muted">
            {competition.resultsReleasedAt
              ? "Final rankings are available to moderators and competition admins."
              : resultsReady
                ? "Thank you for moderating. Results will appear after the circuit tech admin releases them."
              : (lockMessage ?? "Circuit ops opens judging when it is time.")}
          </p>
          {canSeeResults ? (
            <Link href={`/moderator/${competitionId}/results`} className="btn btn-primary mt-4 inline-flex">
              View final rankings
            </Link>
          ) : null}
        </div>
      ) : teams.length === 0 ? (
        <p className="text-muted">No teams applied to this competition.</p>
      ) : (
        <ModeratorLiveConsole
          competitionId={competition.id}
          teams={teams.map(({ position, judges, avDriveUrl }) => ({
            position,
            judges,
            avDriveUrl,
          }))}
          livePosition={livePosition}
        />
      )}
    </div>
  );
}
