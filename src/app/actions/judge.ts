"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import {
  judgingLockMessage,
  maybeReleaseResults,
  parseRubricScore,
  RUBRIC_CATEGORIES,
  isScoreComplete,
  type RubricKey,
} from "@/lib/judging";

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

  const parsed: Partial<Record<RubricKey, number>> = {};
  for (const category of RUBRIC_CATEGORIES) {
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

  const slot = await prisma.judgeViewingSlot.findUnique({
    where: {
      assignmentId_position: { assignmentId, position },
    },
    include: { score: true },
  });
  if (!slot) return { error: "That team slot was not found." };

  const previous = slot.score;
  const next = {
    choreography: parsed.choreography ?? previous?.choreography ?? null,
    formations: parsed.formations ?? previous?.formations ?? null,
    technique: parsed.technique ?? previous?.technique ?? null,
    syncCleanliness: parsed.syncCleanliness ?? previous?.syncCleanliness ?? null,
    overallImpression: parsed.overallImpression ?? previous?.overallImpression ?? null,
    comment,
  };

  await prisma.judgeScore.upsert({
    where: { slotId: slot.id },
    update: next,
    create: {
      assignmentId,
      slotId: slot.id,
      ...next,
    },
  });

  revalidatePath(`/judge/${assignment.competitionId}`);
  revalidatePath(`/judge/${assignment.competitionId}/team/${position}`);
  revalidatePath("/comp/progress");
  revalidatePath("/comp/live");
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
  if (assignment.slots.length === 0) {
    return { error: "No teams in this packet yet." };
  }
  if (assignment.slots.some((slot) => !isScoreComplete(slot.score))) {
    return { error: "Score every team before submitting the packet." };
  }

  await prisma.judgeAssignment.update({
    where: { id: assignment.id },
    data: { submittedAt: new Date() },
  });
  await maybeReleaseResults(assignment.competitionId);

  revalidatePath("/judge");
  revalidatePath(`/judge/${assignment.competitionId}`);
  revalidatePath("/comp");
  revalidatePath("/comp/results");
  revalidatePath("/comp/progress");
  revalidatePath("/comp/live");
  revalidatePath("/comp/judges");
  return { ok: true };
}
