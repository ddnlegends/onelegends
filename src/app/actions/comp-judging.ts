"use server";

/**
 * Competition-admin judging settings: approve or deny judge requests and set
 * the required judge count N.
 *
 * Callers must be an admin of their active competition. Moderator staff for a
 * competition can never be approved to judge it. Lowering N can release
 * results immediately, so it goes through `maybeReleaseResults`.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import { maybeReleaseResults } from "@/lib/release";
import { hasModeratorAccess } from "@/lib/moderator";
import { requireActiveCompetition } from "@/lib/team-access";

export async function decideJudgeRequest(
  assignmentId: string,
  decision: "APPROVED" | "DENIED",
): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!user) return { error: "Unauthorized." };

  const competition = await requireActiveCompetition(user.id);
  if (!competition) return { error: "Competition profile missing." };

  const assignment = await prisma.judgeAssignment.findFirst({
    where: { id: assignmentId, competitionId: competition.id },
    include: { judge: { select: { userId: true, user: { select: { email: true } } } } },
  });
  if (!assignment) return { error: "Request not found." };
  if (assignment.status !== "PENDING") {
    return { error: "That request was already decided." };
  }

  if (decision === "APPROVED") {
    const [moderatorAccess, moderatorInvite] = await Promise.all([
      hasModeratorAccess(assignment.judge.userId, competition.id),
      prisma.moderatorInvite.findUnique({
        where: {
          competitionId_email: {
            competitionId: competition.id,
            email: assignment.judge.user.email,
          },
        },
        select: { id: true },
      }),
    ]);
    if (moderatorAccess || moderatorInvite) {
      return { error: "Moderators for this competition cannot judge it." };
    }
  }

  await prisma.judgeAssignment.update({
    where: { id: assignmentId },
    data: { status: decision, decidedAt: new Date() },
  });

  revalidatePath("/comp/judges");
  revalidatePath("/judge");
  return {};
}

export async function setRequiredJudgeCount(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  if (!user) return { error: "Unauthorized." };

  const competition = await requireActiveCompetition(user.id);
  if (!competition) return { error: "Competition profile missing." };

  const n = Number(formData.get("requiredJudgeCount"));
  if (!Number.isInteger(n) || n < 1 || n > 50) {
    return { error: "Judge count must be a whole number from 1 to 50." };
  }
  if (competition.resultsReleasedAt) {
    return { error: "Required judges cannot change after results are released." };
  }

  const updated = await prisma.competitionProfile.updateMany({
    where: { id: competition.id, resultsReleasedAt: null },
    data: { requiredJudgeCount: n },
  });
  if (updated.count === 0) return { error: "Required judges cannot change after results are released." };
  await maybeReleaseResults(competition.id);

  revalidatePath("/comp");
  revalidatePath("/comp/judges");
  revalidatePath("/comp/results");
  revalidatePath("/comp/profile");
  return { ok: true };
}
