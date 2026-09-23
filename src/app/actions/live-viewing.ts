"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import {
  ensureSharedLiveSlots,
  isCompetitionOpen,
} from "@/lib/judging";
import {
  isPlatformAdmin,
  requireActiveCompetition,
  setActiveCompCookie,
} from "@/lib/team-access";

function revalidateLive(competitionId: string, position?: number) {
  revalidatePath("/comp");
  revalidatePath("/comp/viewing");
  revalidatePath("/comp/judges");
  revalidatePath("/dashboard");
  revalidatePath("/judge");
  revalidatePath(`/judge/${competitionId}`);
  revalidatePath(`/judge/${competitionId}`, "layout");
  if (position) {
    revalidatePath(`/judge/${competitionId}/team/${position}`);
  }
}

async function requireChairCompetition() {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." as const, competition: null, user: null };
  const competition = await requireActiveCompetition(user.id);
  if (!competition) {
    return { error: "You don’t have access to a competition." as const, competition: null, user };
  }
  return { error: null, competition, user };
}

export async function openLiveViewing(formData: FormData) {
  const user = await requireUser();
  if (!user) return;
  const competitionId = String(formData.get("competitionId") ?? "");
  const listing = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    select: { id: true },
  });
  if (!listing) return;
  if (!(await isPlatformAdmin(user.id))) {
    const membership = await prisma.competitionMembership.findUnique({
      where: { userId_competitionId: { userId: user.id, competitionId } },
    });
    if (membership?.status !== "APPROVED") return;
  }
  await setActiveCompCookie(competitionId);
  revalidateLive(competitionId);
  redirect("/comp/viewing");
}

export async function startLiveViewing(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  _formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const { error, competition } = await requireChairCompetition();
  if (error || !competition) return { error: error ?? "Competition missing." };
  if (competition.judgingMode !== "LIVE") {
    return { error: "Turn on live judging in Comp Details first." };
  }
  if (isCompetitionOpen(competition)) {
    return { error: "Close applications before starting the live viewing." };
  }

  await ensureSharedLiveSlots(competition.id);
  const ready = await prisma.competitionProfile.findUnique({
    where: { id: competition.id },
    include: { applications: { select: { id: true } } },
  });
  if (!ready || ready.applications.length === 0) {
    return { error: "No applications to view." };
  }

  await prisma.competitionProfile.update({
    where: { id: competition.id },
    data: { livePosition: 1, liveStartedAt: new Date() },
  });
  revalidateLive(competition.id, 1);
  return { ok: true, message: "Team 1 is up. Share this page on Zoom." };
}

export async function advanceLiveViewing(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  _formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const { error, competition } = await requireChairCompetition();
  if (error || !competition) return { error: error ?? "Competition missing." };
  if (competition.judgingMode !== "LIVE" || !competition.livePosition) {
    return { error: "Start the live viewing first." };
  }

  const total =
    competition.liveOrder.length ||
    (await prisma.application.count({ where: { competitionId: competition.id } }));
  if (competition.livePosition >= total) {
    return { error: "Already on the last team. Judges can submit." };
  }

  await ensureSharedLiveSlots(competition.id);
  const waiting = await judgesMissingCurrentScore(competition.id, competition.livePosition);
  if (waiting.length > 0) {
    return {
      error: `Wait for ${waiting.join(", ")} to save Team ${competition.livePosition}.`,
    };
  }

  const next = competition.livePosition + 1;
  await prisma.competitionProfile.update({
    where: { id: competition.id },
    data: { livePosition: next },
  });
  revalidateLive(competition.id, next);
  revalidateLive(competition.id, competition.livePosition);
  return { ok: true, message: `Team ${next} is up.` };
}

export async function rewindLiveViewing(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  _formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const { error, competition } = await requireChairCompetition();
  if (error || !competition) return { error: error ?? "Competition missing." };
  if (!competition.livePosition || competition.livePosition <= 1) {
    return { error: "Already on the first team." };
  }
  await ensureSharedLiveSlots(competition.id);
  const prev = competition.livePosition - 1;
  await prisma.competitionProfile.update({
    where: { id: competition.id },
    data: { livePosition: prev },
  });
  revalidateLive(competition.id, prev);
  revalidateLive(competition.id, competition.livePosition);
  return { ok: true, message: `Back to Team ${prev}.` };
}

async function judgesMissingCurrentScore(
  competitionId: string,
  position: number,
): Promise<string[]> {
  const assignments = await prisma.judgeAssignment.findMany({
    where: {
      competitionId,
      status: "APPROVED",
      submittedAt: null,
    },
    include: {
      judge: { select: { name: true } },
      slots: {
        where: { position },
        include: { score: true },
      },
    },
  });
  return assignments
    .filter((row) => !row.slots[0]?.score)
    .map((row) => row.judge.name);
}
