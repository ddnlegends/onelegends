"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import {
  ensureCompetitionJudgeSlots,
  isCompetitionClaimed,
  isCompetitionOpen,
} from "@/lib/judging";
import { isPlatformAdmin, setActiveCompCookie } from "@/lib/team-access";

function revalidateJudging(competitionId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/comp");
  revalidatePath("/comp/progress");
  revalidatePath("/comp/live");
  revalidatePath("/comp/judges");
  revalidatePath("/comp/results");
  revalidatePath("/judge");
  revalidatePath(`/judge/${competitionId}`);
  revalidatePath(`/judge/${competitionId}`, "layout");
  revalidatePath("/", "layout");
}

async function requireOpsCompetition(competitionId: string) {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." as const, competition: null };
  if (!(await isPlatformAdmin(user.id))) {
    return { error: "Only circuit ops can open or close judging." as const, competition: null };
  }
  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
  });
  if (!competition) {
    return { error: "Competition not found." as const, competition: null };
  }
  return { error: null, competition };
}

export async function openLiveView(formData: FormData) {
  const user = await requireUser();
  if (!user) return;
  if (!(await isPlatformAdmin(user.id))) return;
  const competitionId = String(formData.get("competitionId") ?? "");
  const listing = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    select: { id: true, claimedAt: true, userId: true, judgingOpen: true },
  });
  if (!listing || !isCompetitionClaimed(listing) || !listing.judgingOpen) return;
  await setActiveCompCookie(competitionId);
  revalidateJudging(competitionId);
  redirect("/comp/live");
}

export async function openJudgingProgress(formData: FormData) {
  const user = await requireUser();
  if (!user) return;
  if (!(await isPlatformAdmin(user.id))) return;
  const competitionId = String(formData.get("competitionId") ?? "");
  const listing = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    select: { id: true, claimedAt: true, userId: true },
  });
  if (!listing || !isCompetitionClaimed(listing)) return;
  await setActiveCompCookie(competitionId);
  revalidateJudging(competitionId);
  redirect("/comp/progress");
}

export async function setJudgingOpen(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const competitionId = String(formData.get("competitionId") ?? "");
  const nextOpen = String(formData.get("open") ?? "") === "1";
  const { error, competition } = await requireOpsCompetition(competitionId);
  if (error || !competition) return { error: error ?? "Competition missing." };

  if (nextOpen) {
    if (!isCompetitionClaimed(competition)) {
      return { error: "A competition admin has to claim this listing first." };
    }
    if (isCompetitionOpen(competition)) {
      return { error: "Close applications before opening judging." };
    }
    const apps = await prisma.application.count({
      where: { competitionId: competition.id },
    });
    if (apps === 0) {
      return { error: "No applications to judge yet." };
    }
    await prisma.competitionProfile.update({
      where: { id: competition.id },
      data: { judgingOpen: true },
    });
    await ensureCompetitionJudgeSlots(competition.id);
    revalidateJudging(competition.id);
    return { ok: true, message: "Judging is open. Judges can score now." };
  }

  await prisma.competitionProfile.update({
    where: { id: competition.id },
    data: { judgingOpen: false },
  });
  revalidateJudging(competition.id);
  return { ok: true, message: "Judging is closed. Judges cannot change scores." };
}
