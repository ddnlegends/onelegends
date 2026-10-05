import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StatusSelect } from "@/components/StatusSelect";
import { rankTeams } from "@/lib/results";
import { formatDateTime } from "@/lib/utils";
import { getActiveCompetitionId } from "@/lib/team-access";

export default async function CompResultsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const competitionId = await getActiveCompetitionId(session.user.id);
  if (!competitionId) return null;
  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    include: {
      applications: { include: { team: true } },
      judgeAssignments: {
        where: { status: "APPROVED" },
        include: {
          judge: true,
          slots: { include: { score: true } },
        },
      },
    },
  });
  if (!competition) return null;

  const submitted = competition.judgeAssignments.filter((a) => a.submittedAt);
  const released = Boolean(competition.resultsReleasedAt);

  const ranked = rankTeams(competition.applications, submitted);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-4xl">Viewing Results</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Names stay sealed until{" "}
          {competition.requiredJudgeCount === 1
            ? "1 judge submits"
            : `${competition.requiredJudgeCount} judges submit`}
          . Rank is average z-score, then average total.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-blush p-5 text-sm">
        {submitted.length} of {competition.requiredJudgeCount} required packets
        submitted
        {released && competition.resultsReleasedAt
          ? ` · Unlocked ${formatDateTime(competition.resultsReleasedAt)}`
          : " · Team names are still hidden"}
        . Lower N on Judges if you need to release early.
      </div>

      {!released ? (
        <p className="text-muted">
          Keep this screen closed to names until the packet is complete. Stats
          stay on Application Stats.
        </p>
      ) : ranked.length === 0 ? (
        <div className="space-y-4">
          <p className="text-muted">No applications to rank.</p>
          <Link href="/comp/applicants" className="btn btn-primary inline-flex">View applied teams</Link>
        </div>
      ) : (
        <div className="space-y-6">
          <Link href="/comp/applicants" className="btn btn-primary inline-flex">View applied teams and full rosters</Link>
          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="border-b border-line bg-blush text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Rank</th>
                  <th className="px-4 py-3 font-medium">Team</th>
                  <th className="px-4 py-3 font-medium">Avg Total</th>
                  <th className="px-4 py-3 font-medium">Avg Z-Score</th>
                  <th className="px-4 py-3 font-medium">Judges</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                  <th className="px-4 py-3 font-medium">Decision</th>
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
                    <td className="px-4 py-3">
                      {row.judges.filter((judge) => judge.comment).length || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusSelect applicationId={row.applicationId} value={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {ranked.map((row, index) => (
            <article
              key={`${row.applicationId}-detail`}
              className="space-y-4 rounded-xl border border-line bg-card p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-heading text-2xl">
                  #{index + 1} {row.name}
                </h2>
                <p className="text-sm text-muted">
                  Avg {row.avgTotal.toFixed(1)} · z {row.avgZ.toFixed(3)}
                </p>
              </div>
              {row.judges.some((judge) => judge.comment) ? (
                <div className="space-y-2 rounded-lg border border-line bg-blush p-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Judge notes
                  </p>
                  <ul className="space-y-2">
                    {row.judges
                      .filter((judge) => judge.comment)
                      .map((judge) => (
                        <li key={`${row.applicationId}-${judge.judgeName}`}>
                          <span className="font-medium">{judge.judgeName}:</span>{" "}
                          {judge.comment}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Judge</th>
                      <th className="py-2 pr-3 font-medium">Choreo</th>
                      <th className="py-2 pr-3 font-medium">Formations</th>
                      <th className="py-2 pr-3 font-medium">Technique</th>
                      <th className="py-2 pr-3 font-medium">Sync</th>
                      <th className="py-2 pr-3 font-medium">Impression</th>
                      <th className="py-2 pr-3 font-medium">Total</th>
                      <th className="py-2 font-medium">Z</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.judges.map((judge) => (
                      <tr key={judge.judgeName} className="border-t border-line">
                        <td className="py-2 pr-3">{judge.judgeName}</td>
                        <td className="py-2 pr-3">{judge.scores.choreography}</td>
                        <td className="py-2 pr-3">{judge.scores.formations}</td>
                        <td className="py-2 pr-3">{judge.scores.technique}</td>
                        <td className="py-2 pr-3">{judge.scores.syncCleanliness}</td>
                        <td className="py-2 pr-3">{judge.scores.overallImpression}</td>
                        <td className="py-2 pr-3">{judge.total}</td>
                        <td className="py-2">{judge.z.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
