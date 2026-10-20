"use server";

/**
 * Team-admin actions: profile, roster, and applying to competitions.
 *
 * Callers must be an admin of their active team. Applying needs a complete
 * profile (`teamProfileGaps`), no circuit block, and an open competition. The
 * Each new application keeps its own AV link. Legacy applications without a
 * saved link retain the viewing-order edit lock for judging safety.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import { isCompetitionOpen } from "@/lib/judging";
import { applicationPhaseAt, expectedApplicationFee } from "@/lib/application-schedule";
import { isCompetitionVisibleToTeams } from "@/lib/competition-profile";
import { canTeamWithdrawApplication } from "@/lib/application-withdrawal";
import { parseDriveUrl } from "@/lib/drive";
import {
  teamProfileGaps,
  teamProfileBlockedMessage,
  TEAM_APPLY_OPS_BLOCKED_MESSAGE,
} from "@/lib/team-profile";
import { getActiveTeamId } from "@/lib/team-access";
import { storeTeamPhoto, hasTeamPhoto } from "@/lib/team-photo";

const profileSchema = z.object({
  name: z.string().min(2, "Team name is required."),
  blurb: z.string().min(1, "Team blurb is required."),
  avDriveUrl: z
    .string()
    .min(1, "AV Google Drive file link is required.")
    .refine((value) => parseDriveUrl(value)?.kind === "file", {
      message:
        "Paste a Google Drive file link (not a folder) and share it so anyone with the link can view.",
    }),
  captains: z.string().min(1, "Captains are required."),
  yearsEstablished: z.string().min(1, "Years established is required."),
  rosterSize: z.string().min(1, "Rostered dancers is required."),
});

const dancerSchema = z.object({
  name: z.string().min(1),
  dietaryRestrictions: z.string(),
  tshirtSize: z.string(),
  inAV: z.boolean(),
  pointOfContact: z.boolean().default(false),
});

function revalidateLiveTeamSurfaces() {
  revalidatePath("/team");
  revalidatePath("/team/profile");
  revalidatePath("/teams", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/judge", "layout");
  revalidatePath("/comp", "layout");
}

function revalidateApplicationSurfaces() {
  revalidateLiveTeamSurfaces();
  revalidatePath("/team/apply");
  revalidatePath("/comp/applicants", "layout");
  revalidatePath("/ops/teams", "layout");
  revalidatePath("/ops/competitions", "layout");
  revalidatePath("/ops/comps", "layout");
  revalidatePath("/moderator", "layout");
}

async function requireApprovedTeam() {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  const teamId = await getActiveTeamId(user.id);
  if (!teamId) {
    return { error: "You don’t have access to a team." };
  }
  const membership = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId: user.id, teamId } },
  });
  if (membership?.status !== "APPROVED") {
    return { error: "You don’t have access to a team." };
  }
  return { user, teamId };
}

export async function saveTeamProfile(
  _prev:
    | { error?: string; ok?: boolean; message?: string; photoUrl?: string }
    | undefined,
  formData: FormData,
): Promise<{
  error?: string;
  ok?: boolean;
  message?: string;
  photoUrl?: string;
}> {
  const access = await requireApprovedTeam();
  if (!("teamId" in access) || !access.teamId) {
    return { error: "error" in access ? access.error : "You don’t have access to a team." };
  }
  const teamId = access.teamId;

  const parsed = profileSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    blurb: String(formData.get("blurb") ?? "").trim(),
    avDriveUrl: String(formData.get("avDriveUrl") ?? "").trim(),
    captains: String(formData.get("captains") ?? "").trim(),
    yearsEstablished: String(formData.get("yearsEstablished") ?? "").trim(),
    rosterSize: String(formData.get("rosterSize") ?? "").trim(),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid profile." };
  }

  const years = Number(parsed.data.yearsEstablished);
  const roster = Number(parsed.data.rosterSize);
  if (!Number.isInteger(years) || years < 0) {
    return { error: "Years established must be 0 or more." };
  }
  if (!Number.isInteger(roster) || roster < 1) {
    return { error: "Rostered dancers must be at least 1." };
  }

  const existing = await prisma.teamProfile.findUnique({
    where: { id: teamId },
    select: {
      photoUrl: true,
      avDriveUrl: true,
      applications: {
        select: {
          submittedAvDriveUrl: true,
          viewingPosition: true,
          competition: { select: { name: true, resultsReleasedAt: true } },
        },
      },
    },
  });
  if (!existing) return { error: "Team profile missing." };
  if (parsed.data.avDriveUrl !== existing.avDriveUrl) {
    const judging = existing.applications.find(
      (app) => !app.submittedAvDriveUrl && app.viewingPosition != null && !app.competition.resultsReleasedAt,
    );
    if (judging) {
      return {
        error: `A legacy application for ${judging.competition.name} is using this AV link during judging. Contact circuit ops if the link is broken.`,
      };
    }
  }

  let photoUrl = existing.photoUrl;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    try {
      const stored = await storeTeamPhoto(teamId, photo);
      if ("error" in stored) return { error: stored.error ?? "Could not save the logo." };
      photoUrl = stored.url;
    } catch {
      return { error: "Could not save the logo. Try again." };
    }
  }
  if (!hasTeamPhoto(photoUrl)) {
    return { error: "Upload a team logo." };
  }

  await prisma.teamProfile.update({
    where: { id: teamId },
    data: {
      name: parsed.data.name,
      photoUrl,
      blurb: parsed.data.blurb,
      avDriveUrl: parsed.data.avDriveUrl,
      captains: parsed.data.captains,
      yearsEstablished: years,
      rosterSize: roster,
    },
  });

  revalidateLiveTeamSurfaces();
  return { ok: true, message: "Changes saved.", photoUrl };
}

export async function saveDancers(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const access = await requireApprovedTeam();
  if (!("teamId" in access)) return { error: access.error };

  const team = await prisma.teamProfile.findUnique({
    where: { id: access.teamId },
  });
  if (!team) return { error: "Team profile missing." };

  const raw = String(formData.get("dancersJson") ?? "[]");
  let dancers: unknown;
  try {
    dancers = JSON.parse(raw);
  } catch {
    return { error: "Could not read dancer list." };
  }

  const parsed = z.array(dancerSchema).safeParse(dancers);
  if (!parsed.success) {
    return { error: "Each dancer needs a name." };
  }

  const cleaned = parsed.data.filter((d) => d.name.trim().length > 0);

  await prisma.$transaction([
    prisma.dancer.deleteMany({ where: { teamId: team.id } }),
    ...(cleaned.length
      ? [
          prisma.dancer.createMany({
            data: cleaned.map((d) => ({
              teamId: team.id,
              name: d.name.trim(),
              dietaryRestrictions: d.dietaryRestrictions.trim(),
              tshirtSize: d.tshirtSize.trim(),
              inAV: d.inAV,
              pointOfContact: d.pointOfContact,
            })),
          }),
        ]
      : []),
    prisma.teamProfile.update({
      where: { id: team.id },
      data: { rosterSize: cleaned.length },
    }),
  ]);

  revalidateLiveTeamSurfaces();
  return { ok: true, message: "Changes saved." };
}

export async function applyToCompetitions(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const access = await requireApprovedTeam();
  if (!("teamId" in access)) return { error: access.error };

  const team = await prisma.teamProfile.findUnique({
    where: { id: access.teamId },
    include: { dancers: true },
  });
  if (!team) return { error: "Team profile missing." };
  if (team.applyBlocked) {
    return { error: TEAM_APPLY_OPS_BLOCKED_MESSAGE };
  }

  const gaps = teamProfileGaps(team);
  if (gaps.length) {
    return { error: teamProfileBlockedMessage(gaps) };
  }

  const selected = formData.getAll("competitionId").map(String);
  if (selected.length === 0) {
    return { error: "Select at least one competition." };
  }

  const comps = await prisma.competitionProfile.findMany({
    where: { id: { in: selected }, claimedAt: { not: null } },
  });
  const appliedAt = new Date();
  const open = comps.filter((c) => isCompetitionVisibleToTeams(c) && isCompetitionOpen(c, appliedAt));

  if (open.length === 0) {
    return { error: "None of those competitions are accepting applications." };
  }

  const existing = await prisma.application.findMany({
    where: { teamId: team.id, competitionId: { in: open.map((c) => c.id) } },
    select: { competitionId: true, removedAt: true, removalReason: true },
  });
  const toCreate = open.filter((competition) => {
    const prior = existing.filter((application) => application.competitionId === competition.id);
    return prior.length === 0 || prior.every((application) =>
      application.removedAt !== null && application.removalReason === "Withdrawn by team",
    );
  });

  let created = 0;
  if (toCreate.length) {
    const result = await prisma.application.createMany({
      data: toCreate.map((c) => ({
        teamId: team.id,
        competitionId: c.id,
        submittedAvDriveUrl: team.avDriveUrl,
        createdAt: appliedAt,
        appliedPhase: applicationPhaseAt(c, appliedAt),
        expectedFeeCents: expectedApplicationFee(c, applicationPhaseAt(c, appliedAt)),
      })),
      skipDuplicates: true,
    });
    created = result.count;
  }

  const skipped = selected.length - created;
  const parts = [
    created
      ? `Applied to ${created} competition${created === 1 ? "" : "s"}.`
      : "No new applications (already applied or unavailable).",
  ];
  if (skipped > 0 && created) {
    parts.push(`${skipped} already on file were skipped.`);
  }

  revalidateApplicationSurfaces();
  return { ok: true, message: parts.join(" ") };
}

/** Teams may withdraw only while their competition is accepting applications. */
export async function withdrawTeamApplication(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const access = await requireApprovedTeam();
  if (!("teamId" in access)) return { error: access.error };
  const applicationId = String(formData.get("applicationId") ?? "");
  if (!applicationId) return { error: "Application not found." };

  const target = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { teamId: true, competitionId: true },
  });
  if (!target || target.teamId !== access.teamId) return { error: "Application not found." };

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${target.competitionId}))`;
    const application = await tx.application.findUnique({
      where: { id: applicationId },
      include: { competition: true },
    });
    if (!application || application.teamId !== access.teamId) return { error: "Application not found." };
    if (!canTeamWithdrawApplication(application)) {
      return { error: "This competition is no longer accepting applications or viewing has started. Contact tech admins for help." };
    }
    await tx.application.update({
      where: { id: application.id },
      data: {
        removedAt: new Date(),
        removedByEmail: access.user.email ?? "Team admin",
        removalReason: "Withdrawn by team",
      },
    });
    return { name: application.competition.name };
  });
  if ("error" in result) return result;
  revalidateApplicationSurfaces();
  return { ok: true, message: `Your application to ${result.name} was withdrawn. You can reapply while applications are open at the current phase and fee.` };
}
