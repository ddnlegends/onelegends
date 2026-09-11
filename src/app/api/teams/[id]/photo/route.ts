import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const blob = await prisma.teamPhotoBlob.findUnique({
    where: { teamId: id },
    select: { bytes: true, mime: true },
  });
  if (!blob) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(Uint8Array.from(blob.bytes), {
    headers: {
      "Content-Type": blob.mime || "application/octet-stream",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
