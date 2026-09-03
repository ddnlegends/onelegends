"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import { syncCompetitionSheet } from "@/lib/sheets";
import { isCompetitionOpen } from "@/lib/judging";
import { parseDriveUrl } from "@/lib/drive";
import {
  teamProfileGaps,
  teamProfileBlockedMessage,
} from "@/lib/team-profile";

const httpUrl = z
  .string()
  .trim()
  .url("Enter a full http(s) URL.")
  .refine(
    (value) => value.startsWith("http://") || value.startsWith("https://"),
    "Enter a full http(s) URL.",
  );

const profileSchema = z.object({
  name: z.string().min(2, "Team name is required."),
  photoUrl: httpUrl,
  blurb: z.string().min(1, "Team blurb is required."),
  wikiUrl: httpUrl,
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
});

export async function saveTeamProfile(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser("TEAM");
  if (!user) return { error: "You must be signed in as a team." };

  const parsed = profileSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    photoUrl: String(formData.get("photoUrl") ?? "").trim(),
    blurb: String(formData.get("blurb") ?? "").trim(),
    wikiUrl: String(formData.get("wikiUrl") ?? "").trim(),
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

  await prisma.teamProfile.update({
    where: { userId: user.id },
    data: {
      name: parsed.data.name,
      photoUrl: parsed.data.photoUrl,
      blurb: parsed.data.blurb,
      wikiUrl: parsed.data.wikiUrl,
      avDriveUrl: parsed.data.avDriveUrl,
      captains: parsed.data.captains,
      yearsEstablished: years,
      rosterSize: roster,
    },
  });

  revalidatePath("/team");
  revalidatePath("/team/profile");
  revalidatePath("/teams");
  return { ok: true };
}

export async function saveDancers(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser("TEAM");
  if (!user) return { error: "You must be signed in as a team." };

  const team = await prisma.teamProfile.findUnique({
    where: { userId: user.id },
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
            })),
          }),
        ]
      : []),
    prisma.teamProfile.update({
      where: { id: team.id },
      data: { rosterSize: cleaned.length },
    }),
  ]);

  revalidatePath("/team");
  revalidatePath("/team/profile");
  return { ok: true };
}

export async function applyToCompetitions(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser("TEAM");
  if (!user) return { error: "You must be signed in as a team." };

  const team = await prisma.teamProfile.findUnique({
    where: { userId: user.id },
    include: { dancers: true },
  });
  if (!team) return { error: "Team profile missing." };

  const gaps = teamProfileGaps(team);
  if (gaps.length) {
    return { error: teamProfileBlockedMessage(gaps) };
  }

  const selected = formData.getAll("competitionId").map(String);
  if (selected.length === 0) {
    return { error: "Select at least one competition." };
  }

  const comps = await prisma.competitionProfile.findMany({
    where: { id: { in: selected } },
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

  await Promise.all(
    toCreate.map((c) =>
      c.googleSheetId || c.googleSheetUrl
        ? syncCompetitionSheet(c.id).catch(() => null)
        : Promise.resolve(null),
    ),
  );

  revalidatePath("/team");
  revalidatePath("/team/apply");
  revalidatePath("/comp");
  return { ok: true, message: parts.join(" ") };
}
