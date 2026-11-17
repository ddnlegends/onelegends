import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isPlatformAdmin } from "@/lib/team-access";
import { buildTeamRosterSheets } from "@/lib/team-rosters-export";
import { toXlsx } from "@/lib/ops-export";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!await isPlatformAdmin(session.user.id)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const teams = await prisma.teamProfile.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      name: true,
      captains: true,
      captainContacts: true,
      dancers: { select: { name: true, tshirtSize: true, dietaryRestrictions: true, inAV: true, pointOfContact: true } },
    },
  });
  const filename = `onelegends-team-rosters-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(await toXlsx(buildTeamRosterSheets(teams)), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
