import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isCompetitionVisibleToTeams } from "@/lib/competition-profile";
import { isCompAdmin } from "@/lib/team-access";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const competition = await prisma.competitionProfile.findUnique({ where: { id } });
  if (!competition) return new NextResponse(null, { status: 404 });
  if (!isCompetitionVisibleToTeams(competition)) {
    const session = await auth();
    if (!session?.user || !(await isCompAdmin(session.user.id, id))) {
      return new NextResponse(null, { status: 404 });
    }
  }
  const packet = await prisma.competitionPacketBlob.findUnique({ where: { competitionId: id } });
  if (!packet) return new NextResponse(null, { status: 404 });
  return new NextResponse(Uint8Array.from(packet.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${packet.filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
