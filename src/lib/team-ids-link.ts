/** Accept only a Google Drive file or folder, and discard tracking parameters. */
export function normalizeTeamIdsDriveUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "drive.google.com" || url.port || url.username || url.password) {
    return null;
  }
  const file = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]{25,})(?:\/(?:view|preview|edit))?\/?$/);
  if (file) return `https://drive.google.com/file/d/${file[1]}/view`;
  const folder = url.pathname.match(/^\/(?:drive\/)?folders\/([A-Za-z0-9_-]{25,})\/?$/);
  if (folder) return `https://drive.google.com/drive/folders/${folder[1]}`;
  return null;
}
