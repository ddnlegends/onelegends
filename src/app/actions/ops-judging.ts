"use server";

/**
 * Circuit ops opens and closes judging for a competition.
 *
 * Requires `platformAdmin`. Opening needs a claimed listing, closed
 * applications, at least one application, and no released results; it builds
 * the shared viewing order and forces `acceptingApps` off (a database CHECK
 * also forbids both flags being true). Closing clears the live team.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import {
  ensureCompetitionJudgeSlots,
  isCompetitionClaimed,
  isCompetitionOpen,
} from "@/lib/judging";
import { isPlatformAdmin } from "@/lib/team-access";

function revalidateJudging(competitionId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/comp");
  revalidatePath("/comp/judges");
  revalidatePath("/comp/results");
  revalidatePath("/ops/comps", "layout");
  revalidatePath("/reg", "layout");
  revalidatePath("/judge");
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

export async function setJudgingOpen(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const competitionId = String(formData.get("competitionId") ?? "");
  const nextOpen = String(formData.get("open") ?? "") === "1";
  const { error, competition } = await requireOpsCompetition(competitionId);
  if (error || !competition) return { error: error ?? "Competition missing." };

  if (nextOpen) {
    if (competition.resultsReleasedAt) {
      return { error: "Judging cannot reopen after results are released." };
    }
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
    await ensureCompetitionJudgeSlots(competition.id);
    const updated = await prisma.competitionProfile.updateMany({
      where: { id: competition.id, resultsReleasedAt: null },
      data: { judgingOpen: true, acceptingApps: false },
    });
    if (updated.count === 0) return { error: "Judging cannot reopen after results are released." };
    revalidateJudging(competition.id);
    return {
      ok: true,
      message: "Judging is open. REG can start live viewing and judges can score.",
    };
  }

  await prisma.competitionProfile.update({
    where: { id: competition.id },
    data: { judgingOpen: false, livePosition: null, liveUpdatedAt: null },
  });
  revalidateJudging(competition.id);
  return { ok: true, message: "Judging is closed. Judges cannot change scores." };
}
