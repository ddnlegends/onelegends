import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompetitionId, isCompAdmin } from "@/lib/team-access";
import { visibleApplicationWhere } from "@/lib/payment-eligibility";
import { moderatorResultsReady } from "@/lib/judge-panel-completion";
import { rankTeams } from "@/lib/results";
import { buildDirectorApplicantWorkbook } from "@/lib/comp-applicants-export";
import { toXlsx } from "@/lib/ops-export";

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const competitionId = await getActiveCompetitionId(userId);
  if (!competitionId || !(await isCompAdmin(userId, competitionId))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    select: {
      name: true,
      resultsReleasedAt: true,
      applications: {
        where: visibleApplicationWhere,
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          teamId: true,
          status: true,
          appliedPhase: true,
          expectedFeeCents: true,
          createdAt: true,
          viewingPosition: true,
          compPaymentReceivedAt: true,
          team: {
            select: {
              id: true,
              name: true,
              photoUrl: true,
              blurb: true,
              wikiUrl: true,
              avDriveUrl: true,
              captains: true,
              yearsEstablished: true,
              rosterSize: true,
              registrationPaidAt: true,
              dancers: {
                orderBy: { name: "asc" },
                select: {
                  name: true,
                  inAV: true,
                  pointOfContact: true,
                  tshirtSize: true,
                  dietaryRestrictions: true,
                },
              },
            },
          },
        },
      },
      judgeInvites: { select: { id: true }, take: 1 },
      judgeAssignments: {
        where: { status: { in: ["APPROVED", "PENDING"] } },
        select: {
          status: true,
          submittedAt: true,
          judge: { select: { name: true } },
          slots: { select: { applicationId: true, score: true } },
        },
      },
    },
  });
  if (!competition) return NextResponse.json({ error: "Competition not found." }, { status: 404 });
  if (!competition.resultsReleasedAt) {
    return NextResponse.json({ error: "Results must be finalized before downloading team details." }, { status: 403 });
  }

  const eligible = competition.applications.filter((application) => application.team.registrationPaidAt);
  const activeJudges = competition.judgeAssignments.filter((assignment) => assignment.status === "APPROVED");
  const unresolved = competition.judgeInvites.length +
    competition.judgeAssignments.filter((assignment) => assignment.status === "PENDING").length;
  if (!moderatorResultsReady(eligible, activeJudges, unresolved)) {
    return NextResponse.json({ error: "Judging is not fully finalized." }, { status: 403 });
  }

  const ranked = rankTeams(eligible, activeJudges);
  const tables = buildDirectorApplicantWorkbook(
    competition.applications,
    ranked,
    new URL(request.url).origin,
  );
  const slug = competition.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "competition";
  const filename = `onelegends-${slug}-final-applicants-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(await toXlsx(tables), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
