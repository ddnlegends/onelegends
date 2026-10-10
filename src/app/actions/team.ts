"use server";

/**
 * Team-admin actions: profile, roster, and applying to competitions.
 *
 * Callers must be an admin of their active team. Applying needs a complete
 * profile (`teamProfileGaps`), no circuit block, and an open competition. The
 * AV link is locked while any application sits in an unreleased viewing order,
 * so the video judges see cannot change mid-judging.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import { isCompetitionOpen } from "@/lib/judging";
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
  soberMonitor: z.boolean().default(false),
});

function revalidateLiveTeamSurfaces() {
  revalidatePath("/team");
  revalidatePath("/team/profile");
  revalidatePath("/teams", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/judge", "layout");
  revalidatePath("/comp", "layout");
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
          viewingPosition: true,
          competition: { select: { name: true, resultsReleasedAt: true } },
        },
      },
    },
  });
  if (!existing) return { error: "Team profile missing." };
  if (parsed.data.avDriveUrl !== existing.avDriveUrl) {
    const judging = existing.applications.find(
      (app) => app.viewingPosition != null && !app.competition.resultsReleasedAt,
    );
    if (judging) {
      return {
        error: `Your audition video is locked until ${judging.competition.name} releases results. Contact circuit ops if the link is broken.`,
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
              soberMonitor: d.soberMonitor,
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
  const open = comps.filter((c) => isCompetitionOpen(c));

  if (open.length === 0) {
    return { error: "None of those competitions are accepting applications." };
  }

  const existing = await prisma.application.findMany({
    where: { teamId: team.id, competitionId: { in: open.map((c) => c.id) } },
    select: { competitionId: true },
  });
  const already = new Set(existing.map((e) => e.competitionId));
  const toCreate = open.filter((c) => !already.has(c.id));

  if (toCreate.length) {
    await prisma.application.createMany({
      data: toCreate.map((c) => ({
        teamId: team.id,
        competitionId: c.id,
      })),
    });
  }

  const skipped = selected.length - toCreate.length;
  const parts = [
    toCreate.length
      ? `Applied to ${toCreate.length} competition${toCreate.length === 1 ? "" : "s"}.`
      : "No new applications (already applied to the selected comps).",
  ];
  if (skipped > 0 && toCreate.length) {
    parts.push(`${skipped} already on file were skipped.`);
  }

  revalidatePath("/team");
  revalidatePath("/team/apply");
  revalidatePath("/comp");
  return { ok: true, message: parts.join(" ") };
}
