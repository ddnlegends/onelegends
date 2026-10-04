import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CompStatusPill } from "@/components/CompStatusPill";
import { DriveAvPlayer } from "@/components/DriveAvPlayer";
import { LiveProgress } from "@/components/LiveProgress";
import { RegLiveConsole } from "@/components/RegLiveConsole";
import {
  competitionStatus,
  ensureSharedViewingOrder,
  isJudgingOpen,
  isScoreComplete,
  judgingLockMessage,
} from "@/lib/judging";
import { hasRegistrationAccess } from "@/lib/registration";

export default async function RegCompetitionPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(await hasRegistrationAccess(session.user.id, competitionId))) notFound();

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
        where: { viewingPosition: { not: null } },
        orderBy: { viewingPosition: "asc" },
        select: {
          id: true,
          viewingPosition: true,
          team: { select: { name: true, avDriveUrl: true } },
        },
      },
      judgeAssignments: {
        where: { status: "APPROVED" },
        select: {
          slots: { select: { applicationId: true, score: true } },
        },
      },
    },
  });
  if (!competition) notFound();

  const status = competitionStatus(competition);
  const judgeCount = competition.judgeAssignments.length;
  const doneByApp = new Map<string, number>();
  for (const assignment of competition.judgeAssignments) {
    for (const slot of assignment.slots) {
      if (isScoreComplete(slot.score)) {
        doneByApp.set(slot.applicationId, (doneByApp.get(slot.applicationId) ?? 0) + 1);
      }
    }
  }
  const teams = competition.applications.map((app) => ({
    position: app.viewingPosition as number,
    name: app.team.name,
    avDriveUrl: app.team.avDriveUrl,
    judgesDone: doneByApp.get(app.id) ?? 0,
  }));
  const livePosition = open ? competition.livePosition : null;
  const live = teams.find((team) => team.position === livePosition) ?? null;
  const lockMessage = judgingLockMessage(competition);

  return (
    <div className="space-y-8">
      <AutoRefresh active={open} intervalMs={6000} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Link href="/reg" prefetch className="text-sm text-muted underline">
            All competitions
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-4xl">{competition.name}</h1>
            <CompStatusPill status={status} />
          </div>
          <p className="max-w-2xl text-sm text-muted">
            Keep this console private: it shows team names. Share the video-only
            presentation tab with judges, and check that the Drive file title
            does not identify the team.
          </p>
        </div>
        {open && teams.length ? (
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
              ? "Results are with the competition."
              : (lockMessage ?? "Circuit ops opens judging when it is time.")}
          </p>
        </div>
      ) : teams.length === 0 ? (
        <p className="text-muted">No teams applied to this competition.</p>
      ) : (
        <RegLiveConsole
          competitionId={competition.id}
          teams={teams.map(({ position, name, judgesDone }) => ({
            position,
            name,
            judgesDone,
          }))}
          livePosition={livePosition}
          judgeCount={judgeCount}
        >
          {live ? (
            <DriveAvPlayer
              key={live.position}
              url={live.avDriveUrl}
              label={`Team ${live.position} audition video`}
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-line bg-blush text-sm text-muted">
              The video for the team you show appears here.
            </div>
          )}
        </RegLiveConsole>
      )}
    </div>
  );
}
