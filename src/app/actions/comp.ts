"use server";

/**
 * Competition-admin actions: edit the listing and accept/waitlist/decline
 * applicants after release.
 *
 * Callers must be an admin of their active competition; circuit ops cannot edit
 * a competition's details.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import { isPlatformAdmin, requireActiveCompetition } from "@/lib/team-access";
import { visibleApplicationWhere } from "@/lib/payment-eligibility";
import { competitionProfileGaps } from "@/lib/competition-profile";
import { isCompetitionOpen } from "@/lib/judging";
import { formatEventDateRange, parseApplicationFee, parseEventDate } from "@/lib/competition-details";

const profileSchema = z.object({
  eventStartDate: z.string(),
  eventEndDate: z.string(),
  location: z.string(),
  venue: z.string(),
  venueAddress: z.string().max(1000, "Venue address must be 1,000 characters or fewer."),
  regularApplicationFee: z.string(),
  lateApplicationFee: z.string(),
  paymentInstructions: z.string().max(5000, "Payment instructions must be 5,000 characters or fewer."),
  stageSize: z.string(),
  productionNotes: z.string(),
  lighting: z.string(),
  description: z.string(),
  acceptingApps: z.string().optional(),
  earlyApplicationDeadline: z.string(),
  applicationDeadline: z.string(),
});

export async function saveCompProfile(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (await isPlatformAdmin(user.id)) {
    return { error: "Competition details can only be edited by that competition’s account." };
  }
  const competition = await requireActiveCompetition(user.id);
  if (!competition) return { error: "You don’t have access to a competition." };

  const parsed = profileSchema.safeParse({
    eventStartDate: String(formData.get("eventStartDate") ?? "").trim(),
    eventEndDate: String(formData.get("eventEndDate") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
    venue: String(formData.get("venue") ?? "").trim(),
    venueAddress: String(formData.get("venueAddress") ?? "").trim(),
    regularApplicationFee: String(formData.get("regularApplicationFee") ?? "").trim(),
    lateApplicationFee: String(formData.get("lateApplicationFee") ?? "").trim(),
    paymentInstructions: String(formData.get("paymentInstructions") ?? "").trim(),
    stageSize: String(formData.get("stageSize") ?? "").trim(),
    productionNotes: String(formData.get("productionNotes") ?? "").trim(),
    lighting: String(formData.get("lighting") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    acceptingApps: formData.get("acceptingApps") ? "on" : "",
    earlyApplicationDeadline: String(formData.get("earlyApplicationDeadline") ?? "").trim(),
    applicationDeadline: String(formData.get("applicationDeadline") ?? "").trim(),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid profile." };
  }

  let dates = competition.dates;
  let eventStartDate = competition.eventStartDate;
  let eventEndDate = competition.eventEndDate;
  if (formData.get("eventDatesTbd") === "on") {
    dates = "TBD";
    eventStartDate = null;
    eventEndDate = null;
  } else if (parsed.data.eventStartDate || parsed.data.eventEndDate) {
    eventStartDate = parseEventDate(parsed.data.eventStartDate);
    eventEndDate = parseEventDate(parsed.data.eventEndDate || parsed.data.eventStartDate);
    if (!eventStartDate || !eventEndDate) return { error: "Choose valid event start and end dates." };
    if (eventEndDate < eventStartDate) return { error: "The event end date must be on or after the start date." };
    dates = formatEventDateRange(eventStartDate, eventEndDate);
  } else if (competition.eventStartDate) {
    return { error: "Choose event dates or select Dates to be announced." };
  }

  const regularApplicationFeeCents = parseApplicationFee(parsed.data.regularApplicationFee);
  const lateApplicationFeeCents = parseApplicationFee(parsed.data.lateApplicationFee);
  if (regularApplicationFeeCents === "invalid" || lateApplicationFeeCents === "invalid") {
    return { error: "Application fees must be between $0 and $99,999.99, with at most two decimal places." };
  }

  const earlyRaw = parsed.data.earlyApplicationDeadline;
  const earlyApplicationDeadline = earlyRaw ? new Date(earlyRaw) : null;
  if (earlyRaw && Number.isNaN(earlyApplicationDeadline?.getTime())) {
    return { error: "Enter a valid regular application deadline." };
  }
  const lateRaw = parsed.data.applicationDeadline;
  const applicationDeadline = lateRaw ? new Date(lateRaw) : null;
  if (lateRaw && Number.isNaN(applicationDeadline?.getTime())) {
    return { error: "Enter a valid late application deadline." };
  }
  if (earlyApplicationDeadline && applicationDeadline && earlyApplicationDeadline >= applicationDeadline) {
    return { error: "The regular deadline must be before the late deadline." };
  }

  const missingDetails = competitionProfileGaps({ ...parsed.data, dates });
  const acceptingApps = parsed.data.acceptingApps === "on" && missingDetails.length === 0;
  if (acceptingApps && competition.resultsReleasedAt) {
    return { error: "Applications cannot reopen after results are released." };
  }
  if (acceptingApps) {
    const [orderedApplication, viewingSlot] = await Promise.all([
      prisma.application.findFirst({
        where: { competitionId: competition.id, viewingPosition: { not: null } },
        select: { id: true },
      }),
      prisma.judgeViewingSlot.findFirst({
        where: { assignment: { competitionId: competition.id } },
        select: { id: true },
      }),
    ]);
    if (competition.judgingOpen || orderedApplication || viewingSlot) {
      return {
        error: "Applications cannot reopen after judging has started.",
      };
    }
  }
  await prisma.competitionProfile.update({
    where: { id: competition.id },
    data: {
      dates,
      eventStartDate,
      eventEndDate,
      location: parsed.data.location,
      venue: parsed.data.venue,
      venueAddress: parsed.data.venueAddress,
      regularApplicationFeeCents,
      lateApplicationFeeCents,
      paymentInstructions: parsed.data.paymentInstructions,
      stageSize: parsed.data.stageSize,
      productionNotes: parsed.data.productionNotes,
      lighting: parsed.data.lighting,
      description: parsed.data.description,
      acceptingApps,
      earlyApplicationDeadline,
      applicationDeadline,
      ...(acceptingApps
        ? { judgingOpen: false, livePosition: null, liveUpdatedAt: null }
        : {}),
    },
  });

  revalidatePath("/comp");
  revalidatePath("/comp/profile");
  revalidatePath("/comp/judges");
  revalidatePath("/comp/results");
  revalidatePath("/comp/applicants");
  revalidatePath("/ops/payments");
  revalidatePath("/ops/comps", "layout");
  revalidatePath("/ops/competitions", "layout");
  revalidatePath("/moderator", "layout");
  revalidatePath("/judge");
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/team/apply");
  revalidatePath("/comps", "layout");
  return {
    ok: true,
    message: missingDetails.length
      ? `Saved as a draft. Your competition is hidden from teams until you fill: ${missingDetails.join(", ")}.`
      : isCompetitionOpen({ acceptingApps, applicationDeadline, resultsReleasedAt: competition.resultsReleasedAt })
        ? "Competition details saved. Your listing is visible and applications are open."
        : "Competition details saved. Your listing is visible, but applications are closed.",
  };
}

export async function setApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!user) return { error: "Unauthorized." };

  const competition = await requireActiveCompetition(user.id);
  if (!competition) return { error: "Competition profile missing." };
  if (!competition.resultsReleasedAt) {
    return { error: "Application decisions unlock after results are released." };
  }

  const app = await prisma.application.findFirst({
    where: { id: applicationId, competitionId: competition.id, ...visibleApplicationWhere },
  });
  if (!app) return { error: "Application not found." };

  await prisma.application.update({
    where: { id: applicationId },
    data: { status },
  });

  revalidatePath("/comp");
  revalidatePath("/comp/results");
  revalidatePath("/comp/applicants");
  revalidatePath("/ops/payments");
  revalidatePath(`/comp/applicants/${app.teamId}`);
  return {};
}

type ApplicantDecision = {
  applicationId: string;
  status: ApplicationStatus;
  paymentReceived: boolean;
};

export async function saveCompApplicantDecisions(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "Unauthorized." };

  const competition = await requireActiveCompetition(user.id);
  if (!competition) return { error: "Competition profile missing." };
  if (!competition.resultsReleasedAt) {
    return { error: "Decisions unlock after results are released." };
  }

  let decisions: ApplicantDecision[];
  try {
    const parsed: unknown = JSON.parse(String(formData.get("decisions") ?? "[]"));
    if (!Array.isArray(parsed)) throw new Error("Invalid decisions.");
    decisions = parsed.map((value) => {
      if (!value || typeof value !== "object") throw new Error("Invalid decisions.");
      const row = value as Record<string, unknown>;
      const statuses: ApplicationStatus[] = ["PENDING", "ACCEPTED", "WAITLISTED", "DECLINED"];
      if (typeof row.applicationId !== "string" || !statuses.includes(row.status as ApplicationStatus)) {
        throw new Error("Invalid decision.");
      }
      return {
        applicationId: row.applicationId,
        status: row.status as ApplicationStatus,
        paymentReceived: row.paymentReceived === true,
      };
    });
  } catch {
    return { error: "Could not read the decision changes." };
  }

  if (!decisions.length || new Set(decisions.map((decision) => decision.applicationId)).size !== decisions.length) {
    return { error: "Include each application exactly once." };
  }
  if (decisions.some((decision) => decision.paymentReceived && decision.status !== "ACCEPTED")) {
    return { error: "Only accepted teams can have a recorded host payment." };
  }

  const applications = await prisma.application.findMany({
    where: {
      competitionId: competition.id,
      id: { in: decisions.map((decision) => decision.applicationId) },
      ...visibleApplicationWhere,
    },
    select: { id: true },
  });
  if (applications.length !== decisions.length) return { error: "One or more applications were not found." };

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${competition.id}))`;
    for (const decision of decisions) {
      await tx.application.update({
        where: { id: decision.applicationId },
        data: {
          status: decision.status,
          compPaymentReceivedAt: decision.paymentReceived ? new Date() : null,
          compPaymentRecordedByEmail: decision.paymentReceived ? user.email : null,
        },
      });
    }
  });

  revalidatePath("/comp");
  revalidatePath("/comp/results");
  revalidatePath("/comp/applicants");
  revalidatePath("/ops/comps", "layout");
  revalidatePath("/ops/competitions", "layout");
  revalidatePath("/ops/payments");
  return { ok: true, message: `${decisions.length} team decisions saved.` };
}
