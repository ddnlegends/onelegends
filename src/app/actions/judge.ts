"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import {
  maybeReleaseResults,
  parseRubricScore,
} from "@/lib/judging";

export async function saveJudgeProfile(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser("JUDGE");
  if (!user) return { error: "You must be signed in as a judge." };

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

export async function requestCompAccess(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser("JUDGE");
  if (!user) return { error: "You must be signed in as a judge." };

  const judge = await prisma.judgeProfile.findUnique({
    where: { userId: user.id },
  });
  if (!judge?.name.trim()) {
    return { error: "Add your name on your judge profile first." };
  }

  const selected = formData.getAll("competitionId").map(String);
  if (selected.length === 0) {
    return { error: "Select at least one competition." };
  }

  const comps = await prisma.competitionProfile.findMany({
    where: { id: { in: selected } },
    select: { id: true },
  });
  if (comps.length === 0) {
    return { error: "Those competitions were not found." };
  }

  const existing = await prisma.judgeAssignment.findMany({
    where: {
      judgeId: judge.id,
      competitionId: { in: comps.map((c) => c.id) },
    },
  });
  const byComp = new Map(existing.map((row) => [row.competitionId, row]));

  let created = 0;
  let reopened = 0;
  for (const comp of comps) {
    const current = byComp.get(comp.id);
    if (!current) {
      await prisma.judgeAssignment.create({
        data: { judgeId: judge.id, competitionId: comp.id },
      });
      created += 1;
      continue;
    }
    if (current.status === "DENIED") {
      await prisma.judgeAssignment.update({
        where: { id: current.id },
        data: {
          status: "PENDING",
          requestedAt: new Date(),
          decidedAt: null,
          submittedAt: null,
        },
      });
      reopened += 1;
    }
  }

  const parts = [];
  if (created) {
    parts.push(
      `Requested ${created} competition${created === 1 ? "" : "s"}.`,
    );
  }
  if (reopened) {
    parts.push(
      `Re-requested ${reopened} previously denied competition${reopened === 1 ? "" : "s"}.`,
    );
  }
  if (!parts.length) {
    parts.push("No new requests. Pending or approved comps were skipped.");
  }

  revalidatePath("/judge");
  revalidatePath("/comp/judges");
  return { ok: true, message: parts.join(" ") };
}

export async function saveTeamScores(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser("JUDGE");
  if (!user) return { error: "You must be signed in as a judge." };

  const assignmentId = String(formData.get("assignmentId") ?? "");
  const position = Number(formData.get("position") ?? "");
  const choreography = parseRubricScore(formData.get("choreography"));
  const formations = parseRubricScore(formData.get("formations"));
  const technique = parseRubricScore(formData.get("technique"));
  const syncCleanliness = parseRubricScore(formData.get("syncCleanliness"));
  const overallImpression = parseRubricScore(formData.get("overallImpression"));

  if (
    choreography == null ||
    formations == null ||
    technique == null ||
    syncCleanliness == null ||
    overallImpression == null
  ) {
    return { error: "Each category must be a whole number from 0 to 10." };
  }

  const assignment = await prisma.judgeAssignment.findFirst({
    where: {
      id: assignmentId,
      status: "APPROVED",
      judge: { userId: user.id },
    },
  });
  if (!assignment) return { error: "Assignment not found." };
  if (assignment.submittedAt) {
    return { error: "This packet is already submitted." };
  }

  const slot = await prisma.judgeViewingSlot.findUnique({
    where: {
      assignmentId_position: { assignmentId, position },
    },
  });
  if (!slot) return { error: "That team slot was not found." };

  await prisma.judgeScore.upsert({
    where: { slotId: slot.id },
    update: {
      choreography,
      formations,
      technique,
      syncCleanliness,
      overallImpression,
    },
    create: {
      assignmentId,
      slotId: slot.id,
      choreography,
      formations,
      technique,
      syncCleanliness,
      overallImpression,
    },
  });

  revalidatePath(`/judge/${assignment.competitionId}`);
  revalidatePath(`/judge/${assignment.competitionId}/team/${position}`);
  return { ok: true };
}

export async function submitJudgingPacket(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser("JUDGE");
  if (!user) return { error: "You must be signed in as a judge." };

  const assignmentId = String(formData.get("assignmentId") ?? "");
  const assignment = await prisma.judgeAssignment.findFirst({
    where: {
      id: assignmentId,
      status: "APPROVED",
      judge: { userId: user.id },
    },
    include: {
      slots: { include: { score: true } },
    },
  });
  if (!assignment) return { error: "Assignment not found." };
  if (assignment.submittedAt) return { ok: true };
  if (assignment.slots.length === 0) {
    return { error: "No teams in this packet yet." };
  }
  if (assignment.slots.some((slot) => !slot.score)) {
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
  revalidatePath("/comp/judges");
  return { ok: true };
}
