"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import { isCompAdmin, isPlatformAdmin } from "@/lib/team-access";

type ActionState = { ok?: boolean; error?: string; message?: string };

function refreshPaymentViews() {
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/team");
  revalidatePath("/comp");
  revalidatePath("/comp/applicants");
  revalidatePath("/comp/results");
  revalidatePath("/ops/teams", "layout");
  revalidatePath("/ops/competitions", "layout");
  revalidatePath("/ops/comps", "layout");
  revalidatePath("/moderator", "layout");
  revalidatePath("/judge");
}

/** Circuit ops records external OneLegends registration payments. */
export async function setRegistrationPaid(_prev: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!user || !(await isPlatformAdmin(user.id))) return { error: "Only tech admins can verify OneLegends payments." };
  const kind = String(formData.get("kind") ?? "");
  const id = String(formData.get("id") ?? "");
  const paid = String(formData.get("paid") ?? "") === "1";
  if (!id || !["team", "competition"].includes(kind)) return { error: "Invalid registration." };

  if (kind === "team") {
    const team = await prisma.teamProfile.findUnique({ where: { id }, select: { name: true } });
    if (!team) return { error: "Team not found." };
    const result = await prisma.$transaction(async (tx) => {
      const applications = await tx.application.findMany({
        where: { teamId: id }, select: { competitionId: true }, orderBy: { competitionId: "asc" },
      });
      for (const application of applications) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${application.competitionId}))`;
      }
      if (!paid && await tx.application.findFirst({
        where: { teamId: id, viewingPosition: { not: null } }, select: { id: true },
      })) return { error: "This team is already in a viewing order. Its payment record cannot be cleared." };
      await tx.teamProfile.update({
        where: { id },
        data: { registrationPaidAt: paid ? new Date() : null, registrationPaidByEmail: paid ? user.email : null },
      });
      return { ok: true };
    });
    if (result.error) return result;
    refreshPaymentViews();
    return { ok: true, message: `${team.name} marked ${paid ? "paid" : "unpaid"}.` };
  }

  const competition = await prisma.competitionProfile.findUnique({ where: { id }, select: { name: true } });
  if (!competition) return { error: "Competition not found." };
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
    if (!paid && await tx.application.findFirst({
      where: { competitionId: id, viewingPosition: { not: null } }, select: { id: true },
    })) return { error: "This competition has a viewing order. Its payment record cannot be cleared." };
    await tx.competitionProfile.update({
      where: { id },
      data: { registrationPaidAt: paid ? new Date() : null, registrationPaidByEmail: paid ? user.email : null },
    });
    return { ok: true };
  });
  if (result.error) return result;
  refreshPaymentViews();
  return { ok: true, message: `${competition.name} marked ${paid ? "paid" : "unpaid"}.` };
}

/** Tech admins exclude one application while preserving a private audit trail. */
export async function removeUnpaidApplication(_prev: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!user || !(await isPlatformAdmin(user.id))) return { error: "Only tech admins can remove applications." };
  const applicationId = String(formData.get("applicationId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!applicationId || !reason || reason.length > 500) return { error: "Enter a reason of 1 to 500 characters." };
  const target = await prisma.application.findUnique({ where: { id: applicationId }, select: { competitionId: true } });
  if (!target) return { error: "Application not found." };
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${target.competitionId}))`;
    const app = await tx.application.findUnique({
      where: { id: applicationId },
      select: { id: true, viewingPosition: true, removedAt: true, team: { select: { name: true } }, competition: { select: { judgingOpen: true, resultsReleasedAt: true } } },
    });
    if (!app) return { error: "Application not found." };
    if (app.removedAt) return { error: "This application was already removed." };
    if (app.viewingPosition != null || app.competition.judgingOpen || app.competition.resultsReleasedAt) {
      return { error: "Applications cannot be removed after a viewing order is created." };
    }
    await tx.application.update({
      where: { id: applicationId },
      data: { removedAt: new Date(), removedByEmail: user.email, removalReason: reason },
    });
    return { name: app.team.name };
  });
  if (result.error) return result;
  refreshPaymentViews();
  return { ok: true, message: `${result.name} removed from this competition.` };
}

/** The host checks its own external payment only after a final Accepted decision. */
export async function setCompPaymentReceived(_prev: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!user) return { error: "Sign in first." };
  if (await isPlatformAdmin(user.id)) return { error: "Competition hosts track their own payments." };
  const applicationId = String(formData.get("applicationId") ?? "");
  const received = String(formData.get("received") ?? "") === "1";
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, competitionId: true, status: true, removedAt: true, team: { select: { applyBlocked: true } }, competition: { select: { resultsReleasedAt: true } } },
  });
  if (!app || app.removedAt || app.team.applyBlocked) return { error: "Application not found." };
  if (!(await isCompAdmin(user.id, app.competitionId))) return { error: "Only this competition's admins can track its payments." };
  if (!app.competition.resultsReleasedAt || app.status !== "ACCEPTED") {
    return { error: "Payment can be recorded after the final Accepted decision." };
  }
  await prisma.application.update({
    where: { id: applicationId },
    data: { compPaymentReceivedAt: received ? new Date() : null, compPaymentRecordedByEmail: received ? user.email : null },
  });
  refreshPaymentViews();
  return { ok: true, message: received ? "Payment marked received." : "Payment marked outstanding." };
}
