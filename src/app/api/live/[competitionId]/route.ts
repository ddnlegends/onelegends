import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isJudgingOpen } from "@/lib/judging";
import { hasRegistrationAccess } from "@/lib/registration";
import { isPlatformAdmin } from "@/lib/team-access";

export async function GET(
  _request: Request,
  context: { params: Promise<{ competitionId: string }> },
) {
  const { competitionId } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const [judge, reg, ops] = await Promise.all([
    prisma.judgeAssignment.findFirst({
      where: { competitionId, status: "APPROVED", judge: { userId } },
      select: { id: true },
    }),
    hasRegistrationAccess(userId, competitionId),
    isPlatformAdmin(userId),
  ]);
  if (!judge && !reg && !ops) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    select: {
      livePosition: true,
      liveUpdatedAt: true,
      judgingOpen: true,
      acceptingApps: true,
      applicationDeadline: true,
      resultsReleasedAt: true,
      claimedAt: true,
      userId: true,
    },
  });
  if (!competition) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const open = isJudgingOpen(competition);
  return NextResponse.json(
    {
      judgingOpen: open,
      livePosition: open ? competition.livePosition : null,
      liveUpdatedAt: competition.liveUpdatedAt?.toISOString() ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
