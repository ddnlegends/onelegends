"use server";

/**
 * Competition-admin actions: edit the listing, accept/waitlist/decline
 * applicants after release, and sync the optional applicant Google Sheet.
 *
 * Callers must be an admin of their active competition; circuit ops cannot edit
 * a competition's details. The applicant sheet refuses to sync before
 * `resultsReleasedAt`, because it contains team names.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import { parseSheetId, syncCompetitionSheet } from "@/lib/sheets";
import { maybeReleaseResults } from "@/lib/release";
import { isPlatformAdmin, requireActiveCompetition } from "@/lib/team-access";

const profileSchema = z.object({
  dates: z.string(),
  location: z.string(),
  venue: z.string(),
  stageSize: z.string(),
  productionNotes: z.string(),
  lighting: z.string(),
  description: z.string(),
  googleSheetUrl: z.string(),
  acceptingApps: z.string().optional(),
  earlyApplicationDeadline: z.string(),
  applicationDeadline: z.string(),
  requiredJudgeCount: z.string(),
});

export async function saveCompProfile(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (await isPlatformAdmin(user.id)) {
    return { error: "Competition details can only be edited by that competition’s account." };
  }
  const competition = await requireActiveCompetition(user.id);
  if (!competition) return { error: "You don’t have access to a competition." };

  const parsed = profileSchema.safeParse({
    dates: String(formData.get("dates") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
    venue: String(formData.get("venue") ?? "").trim(),
    stageSize: String(formData.get("stageSize") ?? "").trim(),
    productionNotes: String(formData.get("productionNotes") ?? "").trim(),
    lighting: String(formData.get("lighting") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    googleSheetUrl: String(formData.get("googleSheetUrl") ?? "").trim(),
    acceptingApps: formData.get("acceptingApps") ? "on" : "",
    earlyApplicationDeadline: String(formData.get("earlyApplicationDeadline") ?? "").trim(),
    applicationDeadline: String(formData.get("applicationDeadline") ?? "").trim(),
    requiredJudgeCount: String(formData.get("requiredJudgeCount") ?? "").trim(),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid profile." };
  }

  const sheetId = parseSheetId(parsed.data.googleSheetUrl);
  const n = Number(parsed.data.requiredJudgeCount);
  if (!Number.isInteger(n) || n < 1 || n > 50) {
    return { error: "Required judges must be a whole number from 1 to 50." };
  }
  if (competition.resultsReleasedAt && n !== competition.requiredJudgeCount) {
    return { error: "Required judges cannot change after results are released." };
  }
  const earlyRaw = parsed.data.earlyApplicationDeadline;
  const earlyApplicationDeadline = earlyRaw ? new Date(earlyRaw) : null;
  if (earlyRaw && Number.isNaN(earlyApplicationDeadline?.getTime())) {
    return { error: "Enter a valid early application deadline." };
  }
  const lateRaw = parsed.data.applicationDeadline;
  const applicationDeadline = lateRaw ? new Date(lateRaw) : null;
  if (lateRaw && Number.isNaN(applicationDeadline?.getTime())) {
    return { error: "Enter a valid late application deadline." };
  }
  if (earlyApplicationDeadline && applicationDeadline && earlyApplicationDeadline >= applicationDeadline) {
    return { error: "The early deadline must be before the late deadline." };
  }

  const acceptingApps = parsed.data.acceptingApps === "on";
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
  const updated = await prisma.competitionProfile.update({
    where: { id: competition.id },
    data: {
      dates: parsed.data.dates,
      location: parsed.data.location,
      venue: parsed.data.venue,
      stageSize: parsed.data.stageSize,
      productionNotes: parsed.data.productionNotes,
      lighting: parsed.data.lighting,
      description: parsed.data.description,
      googleSheetUrl: parsed.data.googleSheetUrl,
      googleSheetId: sheetId,
      acceptingApps,
      earlyApplicationDeadline,
      applicationDeadline,
      requiredJudgeCount: n,
      ...(acceptingApps
        ? { judgingOpen: false, livePosition: null, liveUpdatedAt: null }
        : {}),
    },
  });
  await maybeReleaseResults(updated.id);

  revalidatePath("/comp");
  revalidatePath("/comp/profile");
  revalidatePath("/comp/judges");
  revalidatePath("/comp/results");
  revalidatePath("/ops/comps", "layout");
  revalidatePath("/ops/competitions", "layout");
  revalidatePath("/moderator", "layout");
  revalidatePath("/judge");
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/team/apply");
  revalidatePath("/comps", "layout");
  return { ok: true };
}

export async function setApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!user) return { error: "Unauthorized." };

  const competition = await requireActiveCompetition(user.id);
  if (!competition) return { error: "Competition profile missing." };

  const app = await prisma.application.findFirst({
    where: { id: applicationId, competitionId: competition.id },
  });
  if (!app) return { error: "Application not found." };

  await prisma.application.update({
    where: { id: applicationId },
    data: { status },
  });

  if (competition.googleSheetId || competition.googleSheetUrl) {
    await syncCompetitionSheet(competition.id).catch(() => null);
  }

  revalidatePath("/comp");
  revalidatePath("/comp/results");
  revalidatePath(`/comp/applicants/${app.teamId}`);
  return {};
}

export async function syncMySheet(): Promise<{
  error?: string;
  ok?: boolean;
  message?: string;
}> {
  const user = await requireUser();
  if (!user) return { error: "Unauthorized." };

  const competition = await requireActiveCompetition(user.id);
  if (!competition) return { error: "Competition profile missing." };

  const result = await syncCompetitionSheet(competition.id);
  revalidatePath("/comp");
  return result.ok
    ? { ok: true, message: result.message }
    : { error: result.message };
}
