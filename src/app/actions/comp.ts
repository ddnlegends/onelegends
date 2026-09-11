"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import { parseSheetId, syncCompetitionSheet } from "@/lib/sheets";
import { maybeReleaseResults } from "@/lib/judging";
import { requireActiveCompetition } from "@/lib/team-access";

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
  applicationDeadline: z.string(),
  requiredJudgeCount: z.string(),
});

export async function saveCompProfile(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
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
  const deadlineRaw = parsed.data.applicationDeadline;
  const applicationDeadline = deadlineRaw ? new Date(deadlineRaw) : null;
  if (deadlineRaw && Number.isNaN(applicationDeadline?.getTime())) {
    return { error: "Enter a valid application deadline." };
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
      acceptingApps: parsed.data.acceptingApps === "on",
      applicationDeadline,
      requiredJudgeCount: n,
    },
  });
  await maybeReleaseResults(updated.id);

  revalidatePath("/comp");
  revalidatePath("/comp/profile");
  revalidatePath("/comp/judges");
  revalidatePath("/comp/results");
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
