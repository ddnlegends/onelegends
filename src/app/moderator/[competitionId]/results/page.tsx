import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasModeratorAccess } from "@/lib/moderator";
import { rankTeams } from "@/lib/results";
import { formatDateTime } from "@/lib/utils";

export default async function ModeratorResultsPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(await hasModeratorAccess(session.user.id, competitionId))) notFound();

  const competition = await prisma.competitionProfile.findFirst({
    where: { id: competitionId, resultsReleasedAt: { not: null } },
    select: {
      name: true,
      resultsReleasedAt: true,
      applications: {
        select: {
          id: true,
          teamId: true,
          status: true,
          viewingPosition: true,
          team: { select: { name: true } },
        },
      },
      judgeAssignments: {
        where: { status: "APPROVED", submittedAt: { not: null } },
        select: {
          judge: { select: { name: true } },
          slots: {
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
  if (!competition?.resultsReleasedAt) notFound();

  const ranked = rankTeams(competition.applications, competition.judgeAssignments);

  return (
    <div className="space-y-6">
      <Link href={`/moderator/${competitionId}`} className="text-sm text-muted underline">
        ← Back to viewing
      </Link>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">{competition.name}</p>
        <h1 className="font-heading text-4xl">Final rankings</h1>
        <p className="mt-2 text-muted">
          Read-only results · Released {formatDateTime(competition.resultsReleasedAt)}.
          Ranked by average z-score, then average total.
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
