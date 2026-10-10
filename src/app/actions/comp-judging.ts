"use server";

/**
 * Competition-admin judging decisions and explicit result finalization.
 *
 * Callers must be an admin of their active competition. Moderator staff for a
 * competition can never be approved to judge it.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import { finalizeResults } from "@/lib/release";
import { hasModeratorAccess } from "@/lib/moderator";
import { isCompAdmin, requireActiveCompetition } from "@/lib/team-access";

function refreshJudgeViews(competitionId: string) {
  revalidatePath("/comp/judges");
  revalidatePath("/comp/results");
  revalidatePath("/comp");
  revalidatePath("/dashboard");
  revalidatePath("/judge", "layout");
  revalidatePath("/moderator", "layout");
  revalidatePath("/ops/comps", "layout");
  revalidatePath(`/ops/comps/${competitionId}`);
}

export async function decideJudgeRequest(
  assignmentId: string,
  decision: "APPROVED" | "DENIED",
): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!user) return { error: "Unauthorized." };

  const competition = await requireActiveCompetition(user.id);
  if (!competition) return { error: "Competition profile missing." };
  if (competition.resultsReleasedAt) return { error: "Judge roster is locked after results release." };

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

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "CompetitionProfile" WHERE id = ${competition.id} FOR UPDATE`;
    const current = await tx.competitionProfile.findUnique({ where: { id: competition.id }, select: { resultsReleasedAt: true } });
    if (current?.resultsReleasedAt) return { error: "Judge roster is locked after results release." };
    const pending = await tx.judgeAssignment.findFirst({ where: { id: assignmentId, competitionId: competition.id, status: "PENDING" }, select: { id: true } });
    if (!pending) return { error: "That request was already decided." };
    await tx.judgeAssignment.update({ where: { id: assignmentId }, data: { status: decision, decidedAt: new Date() } });
    return {};
  });
  if (!result.error) refreshJudgeViews(competition.id);
  return result;
}

export async function finalizeCompetitionResults(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  if (!user) return { error: "Unauthorized." };
  const competitionId = String(formData.get("competitionId") ?? "");
  if (formData.get("confirmation") !== "FINALIZE") return { error: "Confirm finalization first." };
  if (!(await isCompAdmin(user.id, competitionId))) return { error: "Only competition or tech admins can finalize results." };
  const actor = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true } });
  if (!actor) return { error: "Account not found." };
  const result = await finalizeResults(competitionId, actor.email);
  if (result.ok) refreshJudgeViews(competitionId);
  return result;
}

export async function removeJudgeAssignment(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "Unauthorized." };
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason || reason.length > 500) return { error: "Enter a reason up to 500 characters." };
  if (formData.get("confirmation") !== "REMOVE") return { error: "Confirm removal first." };
  const assignment = await prisma.judgeAssignment.findUnique({ where: { id: assignmentId }, select: { competitionId: true } });
  if (!assignment) return { error: "Judge assignment not found." };

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "CompetitionProfile" WHERE id = ${assignment.competitionId} FOR UPDATE`;
    const competition = await tx.competitionProfile.findUnique({ where: { id: assignment.competitionId }, select: { resultsReleasedAt: true, judgingOpen: true } });
    if (!competition) return { error: "Competition not found." };
    if (competition.resultsReleasedAt) return { error: "Judges cannot be removed after results release." };
    const actor = await tx.user.findUnique({ where: { id: user.id }, select: { email: true, platformAdmin: true, competitionMemberships: { where: { competitionId: assignment.competitionId, status: "APPROVED", isAdmin: true }, select: { id: true }, take: 1 } } });
    if (!actor) return { error: "Account not found." };
    const started = await tx.application.findFirst({ where: { competitionId: assignment.competitionId, viewingPosition: { not: null } }, select: { id: true } });
    if (!actor.platformAdmin && (!actor.competitionMemberships.length || started)) {
      return { error: "Only Legends tech admins can remove judges after viewing starts." };
    }
    const current = await tx.judgeAssignment.findFirst({ where: { id: assignmentId, competitionId: assignment.competitionId, status: "APPROVED" }, select: { id: true } });
    if (!current) return { error: "Only an active judge can be removed." };
    await tx.judgeAssignment.update({ where: { id: assignmentId }, data: { status: "REMOVED", removedAt: new Date(), removedByEmail: actor.email, removalReason: reason } });
    const remaining = await tx.judgeAssignment.count({ where: { competitionId: assignment.competitionId, status: "APPROVED" } });
    if (remaining === 0 && competition.judgingOpen) {
      await tx.competitionProfile.update({ where: { id: assignment.competitionId }, data: { judgingOpen: false, livePosition: null, liveUpdatedAt: null } });
    }
    return { ok: true, message: remaining === 0 ? "Judge removed. Judging is paused until a replacement is approved." : "Judge removed from the active panel. Their scores are excluded." };
  });
  if (result.ok) refreshJudgeViews(assignment.competitionId);
  return result;
}
