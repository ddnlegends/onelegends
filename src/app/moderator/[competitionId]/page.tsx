import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CompStatusPill } from "@/components/CompStatusPill";
import { LiveProgress } from "@/components/LiveProgress";
import { ModeratorLiveConsole } from "@/components/ModeratorLiveConsole";
import { DriveAvPlayer } from "@/components/DriveAvPlayer";
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
import { usesTechRelease } from "@/lib/competition-type";

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
  const waitingForTech = usesTechRelease(competition) && !competition.resultsReleasedAt &&
    moderatorResultsReady(competition.applications, activeJudges, unresolvedJudges);
  const resultsReady = Boolean(competition.resultsReleasedAt) ||
    (!usesTechRelease(competition) && moderatorResultsReady(competition.applications, activeJudges, 0));
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
  const liveTeam = teams.find((team) => team.position === livePosition);
  const lockMessage = judgingLockMessage(competition);

  return (
    <div className="space-y-8">
      <AutoRefresh active={!resultsReady} intervalMs={6000} />
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
            Teams stay anonymous while judging is open. Rankings unlock after
            tech release for Partner and Affiliate competitions, or after all active judges submit for Non-partner competitions.
          </p>
        </div>
        {open && resultsReady ? (
          <Link
            href={`/moderator/${competitionId}/results`}
            className="btn btn-primary"
          >
            {competition.resultsReleasedAt
              ? "View final rankings"
              : "View completed rankings"}
          </Link>
        ) : open && waitingForTech ? (
          <p className="text-sm text-muted">Thank you for moderating. Results will appear after tech release.</p>
        ) : open && teams.length ? (
          <div className="w-full max-w-xs">
            <LiveProgress current={livePosition} total={teams.length} />
          </div>
        ) : null}
      </div>

      {!open ? (
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
                ? "Every active judge submitted a complete packet. Rankings are ready."
                : usesTechRelease(competition) && activeJudges.every((judge) => judge.submittedAt)
                  ? "Thank you for moderating. Results will appear after tech release."
              : (lockMessage ?? "Circuit ops opens judging when it is time.")}
          </p>
          {resultsReady ? (
            <Link href={`/moderator/${competitionId}/results`} className="btn btn-primary mt-4 inline-flex">
              {competition.resultsReleasedAt
                ? "View final rankings"
                : "View completed rankings"}
            </Link>
          ) : null}
        </div>
      ) : waitingForTech ? (
        <div className="rounded-xl border border-line bg-card p-6">
          <h2 className="font-heading text-2xl">Thank you for moderating</h2>
          <p className="mt-2 text-muted">Judging is complete. Results will appear after tech release.</p>
        </div>
      ) : teams.length === 0 ? (
        <p className="text-muted">No teams applied to this competition.</p>
      ) : (
        <ModeratorLiveConsole
          competitionId={competition.id}
          teams={teams.map(({ position, judges }) => ({
            position,
            judges,
          }))}
          livePosition={livePosition}
        >
          {liveTeam ? (
            <DriveAvPlayer
              key={liveTeam.position}
              url={liveTeam.avDriveUrl}
              label={`Team ${liveTeam.position} audition video`}
              hideOpenLink
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-line bg-blush text-sm text-muted">
              The video for the team you show appears here.
            </div>
          )}
        </ModeratorLiveConsole>
      )}
    </div>
  );
}
