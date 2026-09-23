import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DriveAvPlayer } from "@/components/DriveAvPlayer";
import { CompSwitcher } from "@/components/CompSwitcher";
import { LiveSessionPoll } from "@/components/LiveSessionPoll";
import {
  LiveViewingNav,
  StartLiveViewingForm,
} from "@/components/LiveViewingControls";
import {
  ensureSharedLiveSlots,
  isCompetitionOpen,
} from "@/lib/judging";
import {
  getActiveCompetitionId,
  getApprovedCompMemberships,
  isPlatformAdmin,
} from "@/lib/team-access";

export default async function LiveViewingPage() {
  const session = await auth();
  const userId = session!.user.id;
  const competitionId = await getActiveCompetitionId(userId);
  if (!competitionId) return null;

  const ops = await isPlatformAdmin(userId);
  const memberships = await getApprovedCompMemberships(userId);
  const switcher = ops
    ? await prisma.competitionProfile.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : memberships.map((row) => ({
        id: row.competition.id,
        name: row.competition.name,
      }));

  let competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    include: {
      applications: { select: { id: true } },
      judgeAssignments: {
        where: { status: "APPROVED" },
        include: {
          judge: { select: { name: true } },
          slots: {
            include: { score: true },
            orderBy: { position: "asc" },
          },
        },
        orderBy: { judge: { name: "asc" } },
      },
    },
  });
  if (!competition) return null;

  const live = competition.judgingMode === "LIVE";
  const started = Boolean(competition.livePosition);
  const liveOrder = competition.liveOrder;
  const alreadyAligned =
    liveOrder.length === competition.applications.length &&
    competition.judgeAssignments.every(
      (row) =>
        row.slots.length === liveOrder.length &&
        row.slots.every(
          (slot, index) =>
            slot.position === index + 1 &&
            slot.applicationId === liveOrder[index],
        ),
    );
  if (live && started && !alreadyAligned) {
    await ensureSharedLiveSlots(competition.id);
    competition =
      (await prisma.competitionProfile.findUnique({
        where: { id: competitionId },
        include: {
          applications: { select: { id: true } },
          judgeAssignments: {
            where: { status: "APPROVED" },
            include: {
              judge: { select: { name: true } },
              slots: {
                include: { score: true },
                orderBy: { position: "asc" },
              },
            },
            orderBy: { judge: { name: "asc" } },
          },
        },
      })) ?? competition;
  }
  const position = competition.livePosition ?? 0;
  const total =
    competition.liveOrder.length || competition.applications.length;
  const applicationId =
    position > 0
      ? competition.liveOrder[position - 1] ??
        competition.judgeAssignments[0]?.slots.find(
          (slot) => slot.position === position,
        )?.applicationId
      : undefined;
  const currentApp = applicationId
    ? await prisma.application.findUnique({
        where: { id: applicationId },
        select: { team: { select: { avDriveUrl: true } } },
      })
    : null;

  const judges = competition.judgeAssignments.map((row) => {
    const slot = row.slots.find((item) => item.position === position);
    return {
      id: row.id,
      name: row.judge.name,
      submitted: Boolean(row.submittedAt),
      saved: Boolean(slot?.score),
    };
  });
  const waiting = judges.filter((row) => !row.submitted && !row.saved);
  const canAdvance = started && waiting.length === 0;

  return (
    <div className="space-y-8">
      <LiveSessionPoll active={live && started} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">
            Chair · live viewing
          </p>
          <h1 className="font-heading text-4xl">{competition.name}</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Share this page on Zoom. Judges only see a scoresheet. Team names
            stay off this screen so a screenshare cannot leak them.
          </p>
        </div>
        <Link href="/comp/judges" className="btn btn-ghost">
          Judges
        </Link>
      </div>

      <CompSwitcher competitions={switcher} activeId={competition.id} />

      {!live ? (
        <p className="notice notice-error">
          This listing is still on async judging. Turn on live judging in Comp
          Details, then come back here.
        </p>
      ) : isCompetitionOpen(competition) ? (
        <p className="notice notice-error">
          Close applications before you start. Live viewing uses the locked
          applicant list.
        </p>
      ) : total === 0 ? (
        <p className="text-muted">No applications to view yet.</p>
      ) : !started ? (
        <div className="space-y-4 rounded-xl border border-line bg-card p-6">
          <p className="text-sm text-ink/80">
            {competition.judgeAssignments.length} judge
            {competition.judgeAssignments.length === 1 ? "" : "s"} approved ·{" "}
            {total} teams. Join Zoom, then start Team 1. Everyone scores the
            same order.
          </p>
          <StartLiveViewingForm />
        </div>
      ) : (
        <>
          <div>
            <h2 className="font-heading text-3xl">
              Team {position}{" "}
              <span className="text-lg font-normal text-muted">
                of {total}
              </span>
            </h2>
            <p className="mt-1 text-sm text-muted">
              Play the video, then wait for every judge to save before Next.
            </p>
          </div>
          <DriveAvPlayer
            url={currentApp?.team.avDriveUrl ?? ""}
            label={`Team ${position} audition video`}
            hideOpenLink
          />
          <section className="rounded-xl border border-line bg-card p-5">
            <h3 className="font-heading text-xl">Judges this team</h3>
            <ul className="mt-3 divide-y divide-line">
              {judges.length === 0 ? (
                <li className="py-2 text-sm text-muted">No judges approved.</li>
              ) : (
                judges.map((row) => (
                  <li
                    key={row.id}
                    className="flex justify-between gap-3 py-2 text-sm"
                  >
                    <span>{row.name}</span>
                    <span className="text-muted">
                      {row.submitted
                        ? "Submitted"
                        : row.saved
                          ? "Saved"
                          : "Waiting"}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
          <LiveViewingNav
            position={position}
            total={total}
            canAdvance={canAdvance}
          />
        </>
      )}
    </div>
  );
}
