"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/app/actions/auth";
import { isPlatformAdmin, requireActiveCompetition } from "@/lib/team-access";
import { prisma } from "@/lib/prisma";
import { readApplicationPacket } from "@/lib/competition-packet";

export async function saveCompetitionPacket(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  data: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (await isPlatformAdmin(user.id)) return { error: "Only the competition’s admins can change its application packet." };
  const competition = await requireActiveCompetition(user.id);
  if (!competition) return { error: "You don’t have access to a competition." };
  const remove = data.get("intent") === "remove";
  if (remove) {
    await prisma.competitionPacketBlob.deleteMany({ where: { competitionId: competition.id } });
  } else {
    const file = data.get("packet");
    if (!(file instanceof File)) return { error: "Choose a PDF application packet." };
    const packet = await readApplicationPacket(file);
    if ("error" in packet) return { error: packet.error };
    const update = { bytes: Buffer.from(packet.bytes), filename: packet.filename };
    await prisma.competitionPacketBlob.upsert({
      where: { competitionId: competition.id },
      create: { competitionId: competition.id, ...update },
      update,
    });
  }
  revalidatePath("/comp/profile");
  revalidatePath(`/comps/${competition.id}`);
  revalidatePath("/ops/competitions");
  return { ok: true, message: remove ? "Application packet removed." : "Application packet saved." };
}
