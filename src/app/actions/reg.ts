"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";
import { isPlatformAdmin } from "@/lib/team-access";
import { currentApplicationWhere } from "@/lib/payment-eligibility";
import { regAvFingerprint } from "@/lib/reg-tracking";
import { submittedApplicationAvUrl } from "@/lib/application-av";
import { parseDriveUrl } from "@/lib/drive";

type Result = { ok?: boolean; error?: string; message?: string };
const domain = "@desidancenetwork.org";

async function adminEmail() {
  const user = await requireUser();
  if (!user || !(await isPlatformAdmin(user.id))) return null;
  return user.email?.trim().toLowerCase() ?? null;
}

function refresh(competitionId: string) {
  revalidatePath("/ops/reg", "layout");
  revalidatePath(`/ops/reg/${competitionId}`);
  revalidatePath("/comp");
}

export async function setRegAssignment(_prev: Result | undefined, formData: FormData): Promise<Result> {
  const actor = await adminEmail();
  if (!actor) return { error: "Only tech admins can manage Reg assignments." };
  const parsed = z.object({ competitionId: z.string().min(1), email: z.union([z.literal(""), z.email()]) }).safeParse({
    competitionId: String(formData.get("competitionId") ?? ""),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
  });
  if (!parsed.success) return { error: "Choose a valid tech admin." };
  const { competitionId, email } = parsed.data;
  if (email && !email.endsWith(domain)) return { error: "Reg contacts must use a desidancenetwork.org email." };
  const [account, invite] = email ? await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { platformAdmin: true, name: true } }),
    prisma.platformAdminInvite.findUnique({ where: { email }, select: { id: true } }),
  ]) : [null, null];
  if (email && !account?.platformAdmin && !invite) return { error: "Invite this person as a tech admin first." };
  const contactName = email ? (account?.name?.trim() || email.split("@")[0].split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")) : null;

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "CompetitionProfile" WHERE id = ${competitionId} FOR UPDATE`;
    const comp = await tx.competitionProfile.findUnique({
      where: { id: competitionId },
      select: { name: true, isPartner: true, regAssignment: { select: { email: true } } },
    });
    if (!comp) return { error: "Competition not found." };
    if (!comp.isPartner) return { error: "Reg assignments are only for Partner Competitions." };
    const oldEmail = comp.regAssignment?.email ?? null;
    if (oldEmail === (email || null)) return { ok: true, message: "Assignment is already current." };
    await tx.competitionRegAssignment.upsert({
      where: { competitionId },
      create: { competitionId, email: email || null, contactName, assignedByEmail: actor },
      update: { email: email || null, contactName, assignedAt: new Date(), assignedByEmail: actor },
    });
    await tx.competitionRegAssignmentAudit.create({ data: {
      competitionId, competitionName: comp.name, oldEmail, newEmail: email || null, changedByEmail: actor,
    } });
    return { ok: true, message: email ? `Assigned ${contactName}.` : "Reg chair unassigned." };
  });
  if (result.ok) refresh(competitionId);
  return result;
}

export async function saveRegFollowUp(_prev: Result | undefined, formData: FormData): Promise<Result> {
  const actor = await adminEmail();
  if (!actor) return { error: "Only assigned tech admins can update Reg tracking." };
  const parsed = z.object({
    competitionId: z.string().min(1),
    note: z.string().max(3000, "Keep the note under 3,000 characters."),
    contacted: z.boolean(),
  }).safeParse({
    competitionId: String(formData.get("competitionId") ?? ""),
    note: String(formData.get("note") ?? "").trim(),
    contacted: formData.get("contacted") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid note." };
  const { competitionId, note, contacted } = parsed.data;
  const updated = await prisma.competitionRegAssignment.updateMany({
    where: { competitionId, email: actor, competition: { isPartner: true } },
    data: { followUpNote: note, ...(contacted ? { lastContactAt: new Date() } : {}) },
  });
  if (!updated.count) return { error: "This Partner Competition is not assigned to you." };
  refresh(competitionId);
  return { ok: true, message: contacted ? "Note saved and contact time recorded." : "Note saved." };
}

export async function setRegAvReviewed(_prev: Result | undefined, formData: FormData): Promise<Result> {
  const actor = await adminEmail();
  if (!actor) return { error: "Only assigned tech admins can update Reg tracking." };
  const competitionId = String(formData.get("competitionId") ?? "");
  if (!competitionId) return { error: "Competition missing." };
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "CompetitionProfile" WHERE id = ${competitionId} FOR UPDATE`;
    const comp = await tx.competitionProfile.findUnique({
      where: { id: competitionId },
      select: { isPartner: true, regAssignment: { select: { email: true } }, applications: {
        where: currentApplicationWhere,
        select: { id: true, submittedAvDriveUrl: true, team: { select: { avDriveUrl: true } } },
      } },
    });
    if (!comp?.isPartner || comp.regAssignment?.email !== actor) return { error: "This Partner Competition is not assigned to you." };
    const applications = comp.applications;
    if (!applications.length || applications.some((app) => parseDriveUrl(submittedApplicationAvUrl(app))?.kind !== "file")) {
      return { error: "Every active application needs a Google Drive file link before AV review can be completed." };
    }
    await tx.competitionRegAssignment.update({
      where: { competitionId },
      data: { avReviewedAt: new Date(), avReviewFingerprint: regAvFingerprint(applications) },
    });
    return { ok: true, message: "AV review recorded. New applications or changed AV links will flag it for review again." };
  });
  if (result.ok) refresh(competitionId);
  return result;
}
