import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompetitionId, isCompAdmin } from "@/lib/team-access";
import { formatDate } from "@/lib/utils";
import { visibleApplicationWhere } from "@/lib/payment-eligibility";
import { CompDecisionBoard } from "@/components/CompDecisionBoard";
import { CompPaymentCheckbox } from "@/components/PaymentForms";
import { applicationPhaseLabel } from "@/lib/application-schedule";
import { formatApplicationFee } from "@/lib/competition-details";
import { HostPaymentReview } from "@/components/HostPaymentReview";
import { isCompetitionOpen } from "@/lib/judging-rules";
import { hostCanViewApplicantDetails } from "@/lib/competition-type";
import { offerStatusLabel } from "@/lib/application-offers";

export default async function CompApplicantsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const competitionId = await getActiveCompetitionId(session.user.id);
  if (!competitionId || !(await isCompAdmin(session.user.id, competitionId))) redirect("/comp");
  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    select: {
      name: true,
      acceptingApps: true,
      earlyApplicationDeadline: true,
      applicationDeadline: true,
      applicationClosesAt: true,
      judgingOpen: true,
      resultsReleasedAt: true,
      isPartner: true,
      isAffiliate: true,
      decisionsSubmittedAt: true,
      applications: {
        where: visibleApplicationWhere,
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          status: true,
          teamOfferResponse: true,
          appliedPhase: true,
          expectedFeeCents: true,
          compPaymentReceivedAt: true,
          viewingPosition: true,
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
  const canViewApplicantDetails = hostCanViewApplicantDetails(competition);
  const hasOrder = competition.applications.some((application) => application.viewingPosition != null);
  const canReview = !released && !competition.judgingOpen && !hasOrder && !isCompetitionOpen(competition);
  const decisionRows = competition.applications.map((application) => ({
    applicationId: application.id,
    teamName: application.team.name,
    status: application.status,
    teamOfferResponse: application.teamOfferResponse,
    paymentReceived: Boolean(application.compPaymentReceivedAt),
  }));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl">Applied teams</h1>
          <p className="mt-2 text-muted">{competition.name} · Review applicant names, application dates, dancer counts, phases, and expected host fees. {canViewApplicantDetails ? "Open a team to see its profile, roster, and submitted AV." : "Full team profiles, rosters, and AVs unlock after results release."}</p>
        </div>
        {released ? (
          <a href="/api/comp/applicants/export" className="btn btn-primary">
            Download final team workbook
          </a>
        ) : null}
      </div>
      {!released ? (
        <p className="rounded-xl border border-line bg-blush p-5 text-sm">Tech admins verify OneLegends registration payments before AV viewing. Record payments made to your competition for each applicant below. <strong>Teams not marked paid to your competition will be excluded from AV viewing.</strong> {canViewApplicantDetails ? "Applicant profiles, rosters, and submitted AVs are available below. Viewing order, scores, and results remain hidden until release." : "Viewing order, AV links, scores, and full team details remain hidden until results release."}</p>
      ) : null}
      {hasOrder && !released ? <p className="rounded-xl border border-warning-line bg-warning-soft p-5 text-sm text-warning">The AV viewing order is already locked. Updating a host payment now will not add or remove teams from that order.</p> : null}
      {canReview ? <HostPaymentReview
        teams={competition.applications.map((application) => ({ id: application.id, name: application.team.name, paid: Boolean(application.compPaymentReceivedAt) }))}
      /> : null}
      {released ? <CompDecisionBoard key={`${competition.decisionsSubmittedAt?.toISOString() ?? "draft"}-${decisionRows.map((row) => row.status).join("-")}`} rows={decisionRows} finalized={Boolean(competition.decisionsSubmittedAt)} /> : null}
      {competition.applications.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {competition.applications.map((application) => (
            <li key={application.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                {canViewApplicantDetails ? (
                  <Link href={`/comp/applicants/${application.team.id}`} className="font-semibold hover:underline">{application.team.name}</Link>
                ) : (
                  <span className="font-semibold">{application.team.name}</span>
                )}
                <p className="text-sm text-muted">
                  Applied {formatDate(application.createdAt)} · {application.team._count.dancers} {application.team._count.dancers === 1 ? "dancer" : "dancers"}
                  {released ? ` · ${application.team.captains || "Captains TBA"}` : null}
                </p>
                <p className="mt-1 text-sm font-medium">{application.appliedPhase ? `${applicationPhaseLabel(application.appliedPhase)} phase · Expected host fee: ${formatApplicationFee(application.expectedFeeCents)}` : "Phase and expected host fee were not recorded for this earlier application."}</p>
              </div>
              <div className="space-y-2">
                {released ? (
                  <>
                  <span className="text-sm text-muted">{offerStatusLabel({ ...application, decisionsSubmittedAt: competition.decisionsSubmittedAt })}</span>
                  {application.compPaymentReceivedAt ? " · Host payment received" : ""}
                  </>
                ) : (
                  <CompPaymentCheckbox applicationId={application.id} received={Boolean(application.compPaymentReceivedAt)} />
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="text-muted">No teams have applied.</p>}
    </div>
  );
}
