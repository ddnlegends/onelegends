import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasModeratorAccess } from "@/lib/moderator";
import { rankTeams } from "@/lib/results";
import { LocalDateTime } from "@/components/LocalDateTime";
import { viewingEligibleApplicationWhere } from "@/lib/payment-eligibility";
import { moderatorResultsReady } from "@/lib/judge-panel-completion";

export default async function ModeratorResultsPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(await hasModeratorAccess(session.user.id, competitionId))) notFound();

  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    select: {
      name: true,
      isPartner: true,
      resultsReleasedAt: true,
      applications: {
        where: viewingEligibleApplicationWhere,
        select: {
          id: true,
          teamId: true,
          status: true,
          viewingPosition: true,
          team: { select: { name: true } },
        },
      },
      judgeInvites: { select: { id: true } },
      judgeAssignments: {
        where: { status: { in: ["APPROVED", "PENDING"] } },
        select: {
          status: true,
          submittedAt: true,
          judge: { select: { name: true } },
          slots: {
            where: { application: viewingEligibleApplicationWhere },
            select: {
              applicationId: true,
              score: {
                select: {
                  choreography: true,
                  formations: true,
                  technique: true,
                  syncCleanliness: true,
                  overallImpression: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!competition) notFound();
  const activeJudges = competition.judgeAssignments.filter(
    (assignment) => assignment.status === "APPROVED",
  );
  const unresolvedJudges = competition.judgeInvites.length +
    competition.judgeAssignments.filter((assignment) => assignment.status === "PENDING").length;
  if (!moderatorResultsReady(competition.applications, activeJudges, competition.isPartner ? unresolvedJudges : 0)) notFound();
  if (competition.isPartner && !competition.resultsReleasedAt) {
    return (
      <div className="rounded-xl border border-line bg-card p-6">
        <h1 className="font-heading text-3xl">Thank you for moderating</h1>
        <p className="mt-2 text-muted">{competition.isPartner ? "Results will appear after tech release." : "Results will appear when all active judges finish."}</p>
      </div>
    );
  }

  const ranked = rankTeams(competition.applications, activeJudges);
  const finalized = Boolean(competition.resultsReleasedAt);

  return (
    <div className="space-y-6">
      <Link href={`/moderator/${competitionId}`} className="text-sm text-muted underline">
        ← Back to viewing
      </Link>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">{competition.name}</p>
        <h1 className="font-heading text-4xl">
          {finalized ? "Final rankings" : "Completed rankings"}
        </h1>
        <p className="mt-2 text-muted">
          Read-only results
          {competition.resultsReleasedAt
            ? <> · Released <LocalDateTime date={competition.resultsReleasedAt} /></>
            : " · Every active judge submitted a complete packet"}.
          {" "}Ranked by average z-score, then average total.
        </p>
      </div>
      {ranked.length === 0 ? (
        <p className="text-muted">No applications to rank.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-line bg-blush text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Rank</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Avg Total</th>
                <th className="px-4 py-3 font-medium">Avg Z-Score</th>
                <th className="px-4 py-3 font-medium">Judges</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row, index) => (
                <tr key={row.applicationId} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-heading text-accent">{index + 1}</td>
                  <td className="px-4 py-3 font-semibold">{row.name}</td>
                  <td className="px-4 py-3">{row.avgTotal.toFixed(1)} / 50</td>
                  <td className="px-4 py-3">{row.avgZ.toFixed(3)}</td>
                  <td className="px-4 py-3">{row.judges.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
