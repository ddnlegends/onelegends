"use server";

/**
 * Judge actions: profile, autosaving rubric scores, and submitting a packet.
 *
 * Callers must own an APPROVED assignment for the competition. Saves and
 * submits lock the assignment row (`SELECT ... FOR UPDATE`) and re-check the
 * submitted and judging-open state inside the transaction, so a save can never
 * land after submit and a packet can never submit with missing scores. A
 * submit may release results via `maybeReleaseResults`.
 */
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import {
  judgingLockMessage,
  parseRubricScore,
  RUBRIC_CATEGORIES,
  isScoreComplete,
  type RubricKey,
} from "@/lib/judging";
import { maybeReleaseResults } from "@/lib/release";

export async function saveJudgeProfile(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (name.length < 2) return { error: "Name must be at least 2 characters." };

  await prisma.judgeProfile.update({
    where: { userId: user.id },
    data: { name, phone },
  });

  revalidatePath("/judge");
  revalidatePath("/judge/profile");
  return { ok: true };
}

const COMMENT_MAX = 1000;

/** Serializes score saves and packet submission for one judge so no write lands after submit. */
async function lockAssignment(tx: Prisma.TransactionClient, competitionId: string, assignmentId: string) {
  // Always lock competition first so close/release and score writes serialize.
  await tx.$queryRaw`SELECT id FROM "CompetitionProfile" WHERE id = ${competitionId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "JudgeAssignment" WHERE id = ${assignmentId} FOR UPDATE`;
}

export async function saveTeamScores(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const assignmentId = String(formData.get("assignmentId") ?? "");
  const position = Number(formData.get("position") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  if (comment.length > COMMENT_MAX) {
    return { error: `Comment must be ${COMMENT_MAX} characters or less.` };
  }

  const parsed: Record<RubricKey, number | null> = {
    choreography: null,
    formations: null,
    technique: null,
    syncCleanliness: null,
    overallImpression: null,
  };
  for (const category of RUBRIC_CATEGORIES) {
    if (!formData.has(category.key)) {
      return { error: "Score form is incomplete. Refresh and try again." };
    }
    const raw = String(formData.get(category.key) ?? "").trim();
    if (!raw) continue;
    const value = parseRubricScore(raw);
    if (value == null) {
      return { error: "Each category must be a whole number from 0 to 10." };
    }
    parsed[category.key] = value;
  }

  const assignment = await prisma.judgeAssignment.findFirst({
    where: {
      id: assignmentId,
      status: "APPROVED",
      judge: { userId: user.id },
    },
    include: { competition: true },
  });
  if (!assignment) return { error: "Assignment not found." };
  if (assignment.submittedAt) {
    return { error: "This packet is already submitted." };
  }
  const lock = judgingLockMessage(assignment.competition);
  if (lock) return { error: lock };

  if (!Number.isInteger(position) || position < 1) {
    return { error: "That team slot was not found." };
  }
  const slot = await prisma.judgeViewingSlot.findUnique({
    where: { assignmentId_position: { assignmentId, position } },
    select: { id: true },
  });
  if (!slot) return { error: "That team slot was not found." };

  const next = {
    choreography: parsed.choreography,
    formations: parsed.formations,
    technique: parsed.technique,
    syncCleanliness: parsed.syncCleanliness,
    overallImpression: parsed.overallImpression,
    comment,
  };

  const saved = await prisma.$transaction(async (tx) => {
    await lockAssignment(tx, assignment.competitionId, assignmentId);
    const fresh = await tx.judgeAssignment.findFirst({
      where: { id: assignmentId, status: "APPROVED", judge: { userId: user.id } },
      select: { submittedAt: true, competition: true },
    });
    if (!fresh) return "Assignment not found.";
    if (fresh.submittedAt) return "This packet is already submitted.";
    const freshLock = judgingLockMessage(fresh.competition);
    if (freshLock) return freshLock;
    await tx.judgeScore.upsert({
      where: { slotId: slot.id },
      update: next,
      create: {
        assignmentId,
        slotId: slot.id,
        ...next,
      },
    });
    return null;
  });
  if (saved) return { error: saved };

  revalidatePath(`/judge/${assignment.competitionId}`);
  revalidatePath(`/judge/${assignment.competitionId}/team/${position}`);
  revalidatePath("/ops/comps", "layout");
  revalidatePath("/comp/results");
  return {
    ok: true,
    message: `Scores saved for Team ${position}.`,
  };
}

export async function submitJudgingPacket(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const assignmentId = String(formData.get("assignmentId") ?? "");
  const assignment = await prisma.judgeAssignment.findFirst({
    where: {
      id: assignmentId,
      status: "APPROVED",
      judge: { userId: user.id },
    },
    include: {
      competition: true,
      slots: { include: { score: true } },
    },
  });
  if (!assignment) return { error: "Assignment not found." };
  if (assignment.submittedAt) return { ok: true };
  const lock = judgingLockMessage(assignment.competition);
  if (lock) return { error: lock };
  const failed = await prisma.$transaction(async (tx) => {
    await lockAssignment(tx, assignment.competitionId, assignment.id);
    const fresh = await tx.judgeAssignment.findFirst({
      where: { id: assignment.id, status: "APPROVED", judge: { userId: user.id } },
      select: { submittedAt: true, competition: true, slots: { include: { score: true } } },
    });
    if (!fresh) return "Assignment not found.";
    if (fresh.submittedAt) return null;
    const freshLock = judgingLockMessage(fresh.competition);
    if (freshLock) return freshLock;
    if (fresh.slots.length === 0) return "No teams in this packet yet.";
    if (fresh.slots.some((slot) => !isScoreComplete(slot.score))) {
      return "Score every team before submitting the packet.";
    }
    await tx.judgeAssignment.update({
      where: { id: assignment.id },
      data: { submittedAt: new Date() },
    });
    return null;
  });
  if (failed) return { error: failed };
  await maybeReleaseResults(assignment.competitionId);

  revalidatePath("/judge");
  revalidatePath(`/judge/${assignment.competitionId}`);
  revalidatePath("/comp");
  revalidatePath("/comp/results");
  revalidatePath("/ops/comps", "layout");
  revalidatePath("/comp/judges");
  return { ok: true };
}
