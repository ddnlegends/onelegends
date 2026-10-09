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
import { isJudgingOpen, isScoreComplete, judgingLockMessage } from "@/lib/judging";
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
  const result = await prisma.$transaction(async (tx) => {
    // Score saves lock the same row, so a move sees every committed score.
    await tx.$queryRaw`SELECT id FROM "CompetitionProfile" WHERE id = ${competitionId} FOR UPDATE`;
    const competition = await tx.competitionProfile.findUnique({ where: { id: competitionId } });
    if (!competition) return { error: "Competition not found." };
    if (!isJudgingOpen(competition)) {
      return { error: judgingLockMessage(competition) ?? "Judging is not open yet." };
    }

    if (position != null) {
      const applications = await tx.application.findMany({
        where: { competitionId, viewingPosition: { lte: position } },
        select: { viewingPosition: true },
        orderBy: { viewingPosition: "asc" },
      });
      if (!applications.some((app) => app.viewingPosition === position)) {
        return { error: `Team ${position} is not in this viewing order.` };
      }
      // Rewinding is always allowed. Moving ahead (including after a pause)
      // requires every approved judge to have completed every earlier team.
      if (position > (competition.livePosition ?? 0)) {
        const earlier = applications
          .map((app) => app.viewingPosition)
          .filter((value): value is number => value != null && value < position);
        if (earlier.length) {
          const assignments = await tx.judgeAssignment.findMany({
            where: { competitionId, status: "APPROVED" },
            select: {
              slots: {
                where: { position: { in: earlier } },
                select: { position: true, score: true },
              },
            },
          });
          if (!assignments.length) {
            return { error: "Approve a judge before moving to the next team." };
          }
          for (const earlierPosition of earlier) {
            if (assignments.some((assignment) =>
              !isScoreComplete(assignment.slots.find((slot) => slot.position === earlierPosition)?.score)
            )) {
              return { error: `All approved judges must finish Team ${earlierPosition} before moving ahead.` };
            }
          }
        }
      }
    }

    await tx.competitionProfile.update({
      where: { id: competitionId },
      data: { livePosition: position, liveUpdatedAt: new Date() },
    });
    return { ok: true };
  });
  if (result.error) return result;
  revalidatePath(`/moderator/${competitionId}`);
  revalidatePath(`/judge/${competitionId}`);
  revalidatePath("/ops/comps", "layout");
  return {
    ok: true,
    message:
      position == null
        ? "Judges are no longer following a team."
        : `Judges are on Team ${position} now.`,
  };
}
