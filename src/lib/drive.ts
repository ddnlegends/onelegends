export type DriveResource =
  | { kind: "file"; id: string }
  | { kind: "folder"; id: string };

const FILE_PATTERNS = [
  /\/file\/d\/([a-zA-Z0-9_-]+)/,
  /[?&]id=([a-zA-Z0-9_-]+)/,
  /\/open\?id=([a-zA-Z0-9_-]+)/,
];

export function parseDriveUrl(raw: string): DriveResource | null {
  const url = raw.trim();
  if (!url) return null;

  const folderMatch = url.match(/\/(?:drive\/)?folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) {
    return { kind: "folder", id: folderMatch[1] };
  }

  if (/drive\.google\.com|docs\.google\.com/.test(url)) {
    for (const pattern of FILE_PATTERNS) {
      const match = url.match(pattern);
      if (match?.[1] && match[1].length >= 25) {
        return { kind: "file", id: match[1] };
      }
    }
  }

  const loose = url.match(/[-\w]{25,}/);
  if (loose && /drive\.google\.com/.test(url)) {
    return { kind: "file", id: loose[0] };
  }

  return null;
}

export function drivePreviewSrc(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function driveViewUrl(resource: DriveResource): string {
  if (resource.kind === "folder") {
    return `https://drive.google.com/drive/folders/${resource.id}`;
  }
  return `https://drive.google.com/file/d/${resource.id}/view`;
}
