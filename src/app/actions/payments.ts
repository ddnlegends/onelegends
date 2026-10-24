"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { visibleApplicationWhere } from "@/lib/payment-eligibility";
import { requireUser } from "@/app/actions/auth";
import { isCompAdmin, isPlatformAdmin } from "@/lib/team-access";

type ActionState = { ok?: boolean; error?: string; message?: string };

function refreshPaymentViews() {
  revalidatePath("/payments");
  revalidatePath("/ops/payments");
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

/** Circuit ops verifies every unpaid OneLegends registration fee in one batch. */
export async function markAllRegistrationPaid(_prev: ActionState | undefined, _formData: FormData): Promise<ActionState> {
  void _prev;
  void _formData;
  const user = await requireUser();
  if (!user || !(await isPlatformAdmin(user.id))) return { error: "Only tech admins can verify OneLegends payments." };

  const counts = await prisma.$transaction(async (tx) => {
    const competitions = await tx.competitionProfile.findMany({
      select: { id: true },
      orderBy: { id: "asc" },
    });
    for (const competition of competitions) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${competition.id}))`;
    }

    const paidAt = new Date();
    const teams = await tx.teamProfile.updateMany({
      where: { registrationPaidAt: null },
      data: { registrationPaidAt: paidAt, registrationPaidByEmail: user.email },
    });
    const competitionFees = await tx.competitionProfile.updateMany({
      where: { registrationPaidAt: null },
      data: { registrationPaidAt: paidAt, registrationPaidByEmail: user.email },
    });
    return { teams: teams.count, competitions: competitionFees.count };
  }, { timeout: 15_000 });

  refreshPaymentViews();
  const total = counts.teams + counts.competitions;
  return {
    ok: true,
    message: total
      ? `Marked ${counts.teams} team${counts.teams === 1 ? "" : "s"} and ${counts.competitions} competition${counts.competitions === 1 ? "" : "s"} paid.`
      : "All OneLegends registration fees are already marked paid.",
  };
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

/** The host reviews its own competition fee before viewing; OneLegends payment is separate. */
export async function setCompPaymentReceived(_prev: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!user) return { error: "Sign in first." };
  if (await isPlatformAdmin(user.id)) return { error: "Competition hosts track their own payments." };
  const applicationId = String(formData.get("applicationId") ?? "");
  const requested = formData.has("status")
    ? String(formData.get("status"))
    : String(formData.get("received") ?? "") === "1" ? "PAID" : "UNPAID";
  if (!["PAID", "UNPAID", "WAIVED"].includes(requested)) return { error: "Choose paid, unpaid, or waived." };
  const status = requested as "PAID" | "UNPAID" | "WAIVED";
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, competitionId: true, status: true, removedAt: true, team: { select: { applyBlocked: true } } },
  });
  if (!app || app.removedAt || app.team.applyBlocked) return { error: "Application not found." };
  if (!(await isCompAdmin(user.id, app.competitionId))) return { error: "Only this competition's admins can track its payments." };
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${app.competitionId}))`;
    await tx.$queryRaw`SELECT id FROM "CompetitionProfile" WHERE id = ${app.competitionId} FOR UPDATE`;
    const competition = await tx.competitionProfile.findUnique({ where: { id: app.competitionId }, select: { judgingOpen: true, resultsReleasedAt: true, decisionsSubmittedAt: true } });
    const current = await tx.application.findUnique({ where: { id: applicationId }, select: { removedAt: true, status: true } });
    if (!competition || !current || current.removedAt) return { error: "Application not found." };
    const anyViewingOrder = await tx.application.count({ where: { competitionId: app.competitionId, viewingPosition: { not: null } } });
    const frozen = Boolean(anyViewingOrder || competition.judgingOpen || competition.resultsReleasedAt);
    if (frozen && (!competition.decisionsSubmittedAt || current.status !== "ACCEPTED")) {
      return { error: "Host payments are locked during viewing. Final accepted-team payments can still be updated." };
    }
    await tx.application.update({
      where: { id: applicationId },
      data: {
        compPaymentReviewStatus: status,
        compPaymentReceivedAt: status === "PAID" ? new Date() : null,
        compPaymentRecordedByEmail: user.email,
      },
    });
    if (!frozen) await tx.competitionProfile.update({
      where: { id: app.competitionId },
      data: { compPaymentsVerifiedAt: null, compPaymentsVerifiedByEmail: null },
    });
    return { ok: true };
  });
  if (result.error) return result;
  refreshPaymentViews();
  return { ok: true, message: `Host payment marked ${status.toLowerCase()}.` };
}

export async function verifyCompPayments(_prev: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!user || await isPlatformAdmin(user.id)) return { error: "Only competition admins can verify host payments." };
  const competitionId = String(formData.get("competitionId") ?? "");
  if (!(await isCompAdmin(user.id, competitionId))) return { error: "Only this competition's admins can verify host payments." };
  if (formData.get("confirmation") !== "VERIFY") return { error: "Confirm the payment review first." };
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${competitionId}))`;
    await tx.$queryRaw`SELECT id FROM "CompetitionProfile" WHERE id = ${competitionId} FOR UPDATE`;
    const competition = await tx.competitionProfile.findUnique({ where: { id: competitionId }, select: { judgingOpen: true, resultsReleasedAt: true } });
    if (!competition) return { error: "Competition not found." };
    if (competition.judgingOpen || competition.resultsReleasedAt || await tx.application.count({ where: { competitionId, viewingPosition: { not: null } } })) {
      return { error: "Viewing has already started; the payment review is locked." };
    }
    const applications = await tx.application.findMany({
      where: { competitionId, ...visibleApplicationWhere },
      select: { compPaymentReviewStatus: true },
    });
    if (!applications.length) return { error: "No active teams to review." };
    if (applications.some((application) => application.compPaymentReviewStatus === "UNREVIEWED")) {
      return { error: "Mark every active team paid, unpaid, or waived before verifying." };
    }
    await tx.competitionProfile.update({
      where: { id: competitionId },
      data: { compPaymentsVerifiedAt: new Date(), compPaymentsVerifiedByEmail: user.email },
    });
    return { ok: true };
  });
  if (result.error) return result;
  refreshPaymentViews();
  return { ok: true, message: "Host payment review verified. Unpaid teams will not appear in AV viewing." };
}
