import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  TEAM_PHOTO_BAD_TYPE,
  TEAM_PHOTO_MAX_BYTES,
  TEAM_PHOTO_TOO_LARGE,
} from "@/lib/team-photo-rules";
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "teams");

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function hasTeamPhoto(value: string): boolean {
  const photo = value.trim();
  if (!photo) return false;
  if (photo.startsWith("/uploads/")) return true;
  try {
    const url = new URL(photo);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function extensionFor(file: File, bytes: Uint8Array): string | null {
  const fromType = TYPES[file.type];
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
  return fromType ?? null;
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
  const ext = extensionFor(file, bytes);
  if (!ext) {
    return { error: TEAM_PHOTO_BAD_TYPE };
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const existing = await readdir(UPLOAD_DIR);
  await Promise.all(
    existing
      .filter((name) => name === teamId || name.startsWith(`${teamId}.`))
      .map((name) => unlink(path.join(UPLOAD_DIR, name))),
  );

  const filename = `${teamId}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), bytes);
  return { url: `/uploads/teams/${filename}?v=${Date.now()}` };
}
