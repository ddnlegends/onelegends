export const TEAM_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const TEAM_PHOTO_TOO_LARGE =
  "Team logo must be 5MB or smaller. Choose a smaller image and save again.";
export const TEAM_PHOTO_BAD_TYPE = "Upload a JPEG, PNG, WebP, or GIF logo.";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function teamPhotoSrc(teamId: string, version?: number | string): string {
  return `/api/teams/${teamId}/photo?v=${version ?? Date.now()}`;
}

export function hasTeamPhoto(value: string): boolean {
  const photo = value.trim();
  if (!photo) return false;
  if (photo.startsWith("/api/teams/") && photo.includes("/photo")) return true;
  try {
    const url = new URL(photo);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function teamPhotoFileError(file: File): string | null {
  if (file.size > TEAM_PHOTO_MAX_BYTES) return TEAM_PHOTO_TOO_LARGE;
  if (file.type && !ALLOWED_TYPES.has(file.type)) return TEAM_PHOTO_BAD_TYPE;
  return null;
}

export function isBodyLimitError(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : String(error ?? "");
  return /body exceeded|body size limit|6mb limit/i.test(text);
}
