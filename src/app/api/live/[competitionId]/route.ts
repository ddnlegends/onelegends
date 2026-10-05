/**
 * Live viewing state that judge and REG pages poll every few seconds.
 *
 * Only that competition's approved judges, its REG staff, and platform admins
 * may read it. Returns anonymous data only: whether judging is open and which
 * Team number is on screen.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isJudgingOpen } from "@/lib/judging-rules";

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

  // Polled every few seconds by every judge, so all reads run in one round.
  // The competition row is only returned after the access check passes.
  // `platformAdmin` on the session is re-read from the database by the jwt
  // callback on every request.
  const ops = Boolean(session.user.platformAdmin);
  const [judge, reg, competition] = await Promise.all([
    ops
      ? null
      : prisma.judgeAssignment.findFirst({
          where: { competitionId, status: "APPROVED", judge: { userId } },
          select: { id: true },
        }),
    ops
      ? null
      : prisma.registrationAccess.findUnique({
          where: { userId_competitionId: { userId, competitionId } },
          select: { id: true },
        }),
    prisma.competitionProfile.findUnique({
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
    }),
  ]);
  if (!judge && !reg && !ops) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
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
