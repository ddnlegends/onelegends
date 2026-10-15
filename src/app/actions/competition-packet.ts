"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/app/actions/auth";
import { isPlatformAdmin, requireActiveCompetition } from "@/lib/team-access";
import { prisma } from "@/lib/prisma";
import { normalizePacketDriveUrl } from "@/lib/competition-packet";

export async function saveCompetitionPacketLink(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  data: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (await isPlatformAdmin(user.id)) return { error: "Only the competition’s admins can change its application packet." };
  const competition = await requireActiveCompetition(user.id);
  if (!competition) return { error: "You don’t have access to a competition." };
  const remove = data.get("intent") === "remove";
  const url = remove ? null : normalizePacketDriveUrl(String(data.get("packetDriveUrl") ?? ""));
  if (!remove && !url) return { error: "Enter a valid Google Drive file link." };
  await prisma.competitionProfile.update({
    where: { id: competition.id },
    data: { applicationPacketDriveUrl: url, applicationPacketLegacyHidden: true },
  });
  revalidatePath("/comp/profile");
  revalidatePath(`/comps/${competition.id}`);
  revalidatePath("/ops/competitions");
  return { ok: true, message: remove ? "Application packet link removed." : "Application packet link saved." };
}
