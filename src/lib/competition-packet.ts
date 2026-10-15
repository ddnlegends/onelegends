// Leaves room for multipart overhead under Vercel's 4.5 MB payload limit.
export const PACKET_MAX_BYTES = 3 * 1024 * 1024;
export const PACKET_TOO_LARGE = "Application packet must be 3 MB or smaller.";

export function packetFileError(file: File): string | null {
  if (!file.size) return "Choose a PDF application packet.";
  if (file.size > PACKET_MAX_BYTES) return PACKET_TOO_LARGE;
  if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf")) {
    return "Upload a PDF application packet.";
  }
  return null;
}

export async function readApplicationPacket(file: File) {
  const error = packetFileError(file);
  if (error) return { error };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > PACKET_MAX_BYTES) return { error: PACKET_TOO_LARGE };
  const header = new TextDecoder().decode(bytes.slice(0, 8));
  const tail = new TextDecoder().decode(bytes.slice(-1024));
  if (!/^%PDF-\d\.\d/.test(header) || !tail.includes("%%EOF")) {
    return { error: "This file does not appear to be a PDF. Export it as a PDF and try again." };
  }
  // A safe ASCII download filename avoids path/header injection and misleading extensions.
  const base = file.name.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120);
  return { bytes, filename: `${base || "application-packet"}.pdf` };
}
