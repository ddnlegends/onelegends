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

type ApplicantDecision = {
  applicationId: string;
  status: ApplicationStatus;
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
  const final = formData.get("intent") === "final";
  if (final && formData.get("acknowledgeFinal") !== "on") {
    return { error: "Confirm that all team outcomes are final before submitting." };
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
      };
    });
  } catch {
    return { error: "Could not read the decision changes." };
  }

  if (!decisions.length || new Set(decisions.map((decision) => decision.applicationId)).size !== decisions.length) {
    return { error: "Include each application exactly once." };
  }
  if (final && decisions.some((decision) => decision.status === "PENDING")) {
    return { error: "Choose an outcome for every team before submitting final decisions." };
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${competition.id}))`;
    const current = await tx.competitionProfile.findUnique({
      where: { id: competition.id },
      select: { resultsReleasedAt: true, decisionsSubmittedAt: true },
    });
    if (!current?.resultsReleasedAt) return { error: "Results must be released first." };
    if (current.decisionsSubmittedAt) return { error: "Final decisions have already been submitted." };
    const applications = await tx.application.findMany({
      where: { competitionId: competition.id, ...visibleApplicationWhere },
      select: { id: true },
    });
    const submittedIds = new Set(decisions.map((decision) => decision.applicationId));
    if (applications.length !== decisions.length || applications.some((app) => !submittedIds.has(app.id))) {
      return { error: "The applicant list changed. Refresh and review every team before saving." };
    }
    for (const decision of decisions) {
      await tx.application.update({
        where: { id: decision.applicationId },
        data: { status: decision.status },
      });
    }
    if (final) {
      await tx.competitionProfile.update({
        where: { id: competition.id },
        data: { decisionsSubmittedAt: new Date() },
      });
    }
    return { ok: true };
  });
  if (result.error) return result;

  revalidatePath("/comp");
  revalidatePath("/comp/results");
  revalidatePath("/comp/applicants");
  revalidatePath("/team", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/ops/comps", "layout");
  revalidatePath("/ops/competitions", "layout");
  revalidatePath("/ops/payments");
  return { ok: true, message: final
    ? `${decisions.length} final team decisions submitted. Teams can now see their outcomes.`
    : `${decisions.length} draft decisions saved. Teams still see Pending.` };
}
