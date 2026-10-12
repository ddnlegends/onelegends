import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompetitionId, isCompAdmin } from "@/lib/team-access";
import { formatDate, statusLabel } from "@/lib/utils";
import { visibleApplicationWhere } from "@/lib/payment-eligibility";
import { CompDecisionBoard } from "@/components/CompDecisionBoard";

export default async function CompApplicantsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const competitionId = await getActiveCompetitionId(session.user.id);
  if (!competitionId || !(await isCompAdmin(session.user.id, competitionId))) redirect("/comp");
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
          createdAt: true,
          status: true,
          compPaymentReceivedAt: true,
          team: {
            select: {
              id: true,
              name: true,
              captains: true,
              _count: { select: { dancers: true } },
            },
          },
        },
      },
    },
  });
  if (!competition) redirect("/comp");
  const released = Boolean(competition.resultsReleasedAt);
  const decisionRows = competition.applications.map((application) => ({
    applicationId: application.id,
    teamName: application.team.name,
    status: application.status,
    paymentReceived: Boolean(application.compPaymentReceivedAt),
  }));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl">Applied teams</h1>
        <p className="mt-2 text-muted">{competition.name} · Track competition payments for teams accepted after judging. Full rosters and results unlock after judging.</p>
      </div>
      {!released ? (
        <p className="rounded-xl border border-line bg-blush p-5 text-sm">Tech admins verify OneLegends registration payments before AV viewing. Competition payments are tracked after final acceptance. Viewing order, AV links, scores, and full team details remain hidden until results release.</p>
      ) : null}
      {released ? <CompDecisionBoard rows={decisionRows} /> : null}
      {competition.applications.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {competition.applications.map((application) => (
            <li key={application.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                {released ? (
                  <Link href={`/comp/applicants/${application.team.id}`} className="font-semibold hover:underline">{application.team.name}</Link>
                ) : (
                  <span className="font-semibold">{application.team.name}</span>
                )}
                <p className="text-sm text-muted">
                  Applied {formatDate(application.createdAt)} · {application.team._count.dancers} {application.team._count.dancers === 1 ? "dancer" : "dancers"}
                  {released ? ` · ${application.team.captains || "Captains TBA"}` : null}
                </p>
              </div>
              {released ? (
                <div className="space-y-2">
                  <span className="text-sm text-muted">{statusLabel(application.status)}</span>
                  {application.compPaymentReceivedAt ? " · Host payment received" : ""}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className="text-muted">No teams have applied.</p>}
    </div>
  );
}
