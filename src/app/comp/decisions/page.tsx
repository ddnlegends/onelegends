import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompetitionId, isCompAdmin } from "@/lib/team-access";
import { visibleApplicationWhere } from "@/lib/payment-eligibility";
import { NonPartnerDecisionRow } from "@/components/NonPartnerDecisionRow";

export default async function NonPartnerDecisionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const competitionId = await getActiveCompetitionId(session.user.id);
  if (!competitionId || !(await isCompAdmin(session.user.id, competitionId))) notFound();
  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    select: {
      name: true, isPartner: true, isAffiliate: true, decisionsSubmittedAt: true,
      applications: {
        where: visibleApplicationWhere,
        orderBy: { createdAt: "asc" },
        select: {
          id: true, status: true, decisionPublishedAt: true, teamOfferResponse: true,
          team: { select: { name: true } },
        },
      },
    },
  });
  if (!competition || competition.isPartner || competition.isAffiliate) notFound();
  const published = competition.applications.filter((app) => app.decisionPublishedAt || competition.decisionsSubmittedAt).length;
  return <div className="space-y-6">
    <div>
      <Link href="/comp/applicants" className="text-sm underline">← Applied teams</Link>
      <h1 className="mt-3 font-heading text-4xl">Rolling decisions</h1>
      <p className="mt-2 text-muted">{competition.name} · Save Accepted or Declined privately, then publish each team’s final outcome. A published acceptance becomes an offer the team can confirm or decline.</p>
    </div>
    <div className="rounded-xl border border-line bg-blush p-5 text-sm">
      {published} of {competition.applications.length} decisions published. Published decisions appear to the corresponding team immediately and cannot be edited here.
    </div>
    {competition.applications.length ? <div className="overflow-hidden rounded-xl border border-line bg-card">
      {competition.applications.map((application) => <NonPartnerDecisionRow
        key={`${application.id}-${application.status}-${application.decisionPublishedAt?.toISOString() ?? "draft"}`}
        applicationId={application.id}
        teamName={application.team.name}
        initialStatus={application.status}
        publishedAt={application.decisionPublishedAt ?? competition.decisionsSubmittedAt}
        teamOfferResponse={application.teamOfferResponse}
      />)}
    </div> : <p className="text-muted">No active applications yet.</p>}
  </div>;
}
