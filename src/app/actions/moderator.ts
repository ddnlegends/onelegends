"use server";

/**
 * Moderator puts a team on screen. Every judge's sheet follows `livePosition`.
 *
 * Requires moderator access to the competition (and not being one of its
 * judges) while judging is open. Positions are anonymous Team numbers.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import { isJudgingOpen, judgingLockMessage } from "@/lib/judging";
import { hasModeratorAccess } from "@/lib/moderator";

export async function setLiveTeam(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const competitionId = String(formData.get("competitionId") ?? "");
  const raw = String(formData.get("position") ?? "");
  const position = raw === "" ? null : Number(raw);
  if (position != null && (!Number.isInteger(position) || position < 1)) {
    return { error: "Pick a team from the list." };
  }

  if (!(await hasModeratorAccess(user.id, competitionId))) {
    return { error: "Only moderators for this competition can run live viewing." };
  }
  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
  });
  if (!competition) return { error: "Competition not found." };
  if (!isJudgingOpen(competition)) {
    return {
      error: judgingLockMessage(competition) ?? "Judging is not open yet.",
    };
  }

  if (position != null) {
    const exists = await prisma.application.findUnique({
      where: {
        competitionId_viewingPosition: { competitionId, viewingPosition: position },
      },
      select: { id: true },
    });
    if (!exists) return { error: `Team ${position} is not in this viewing order.` };
  }

  await prisma.competitionProfile.update({
    where: { id: competitionId },
    data: { livePosition: position, liveUpdatedAt: new Date() },
  });

  revalidatePath(`/moderator/${competitionId}`);
  revalidatePath("/ops/comps", "layout");
  return {
    ok: true,
    message:
      position == null
        ? "Judges are no longer following a team."
        : `Judges are on Team ${position} now.`,
  };
}
