/** Only accept a Drive file link and store a canonical URL without sharing parameters. */
export function normalizePacketDriveUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "drive.google.com" || url.port || url.username || url.password) {
    return null;
  }
  const pathMatch = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]{25,})(?:\/(?:view|preview|edit))?\/?$/);
  const queryId = url.pathname === "/open" || url.pathname === "/uc" ? url.searchParams.get("id") : null;
  const id = pathMatch?.[1] ?? (queryId && /^[A-Za-z0-9_-]{25,}$/.test(queryId) ? queryId : null);
  return id ? `https://drive.google.com/file/d/${id}/view` : null;
}
