import { prisma } from "@/lib/prisma";
import {
  TEAM_PHOTO_BAD_TYPE,
  TEAM_PHOTO_MAX_BYTES,
  TEAM_PHOTO_TOO_LARGE,
  teamPhotoSrc,
} from "@/lib/team-photo-rules";

export { hasTeamPhoto, teamPhotoSrc } from "@/lib/team-photo-rules";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function kindFor(file: File, bytes: Uint8Array): keyof typeof MIME | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return null;
}

export async function storeTeamPhoto(
  teamId: string,
  file: File,
): Promise<{ url: string } | { error: string }> {
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a team photo to upload." };
  }
  if (file.size > TEAM_PHOTO_MAX_BYTES) {
    return { error: TEAM_PHOTO_TOO_LARGE };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > TEAM_PHOTO_MAX_BYTES) {
    return { error: TEAM_PHOTO_TOO_LARGE };
  }
  const kind = kindFor(file, bytes);
  if (!kind) {
    return { error: TEAM_PHOTO_BAD_TYPE };
  }

  await prisma.teamPhotoBlob.upsert({
    where: { teamId },
    create: { teamId, bytes: Buffer.from(bytes), mime: MIME[kind] },
    update: { bytes: Buffer.from(bytes), mime: MIME[kind] },
  });

  return { url: teamPhotoSrc(teamId) };
}
