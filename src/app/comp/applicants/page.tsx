import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompetitionId, isCompAdmin } from "@/lib/team-access";
import { formatDate, statusLabel } from "@/lib/utils";
import { visibleApplicationWhere } from "@/lib/payment-eligibility";
import { CompDecisionBoard } from "@/components/CompDecisionBoard";
import { applicationPhaseLabel } from "@/lib/application-schedule";
import { formatApplicationFee } from "@/lib/competition-details";
import { HostPaymentReview } from "@/components/HostPaymentReview";

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
      decisionsSubmittedAt: true,
      judgingOpen: true,
      compPaymentsVerifiedAt: true,
      applications: {
        where: visibleApplicationWhere,
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          status: true,
          appliedPhase: true,
          expectedFeeCents: true,
          compPaymentReceivedAt: true,
          compPaymentReviewStatus: true,
          viewingPosition: true,
          team: {
            select: {
              id: true,
              name: true,
              captains: true,
              registrationPaidAt: true,
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
    paymentStatus: application.compPaymentReviewStatus,
  }));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl">Applied teams</h1>
          <p className="mt-2 text-muted">{competition.name} · Review applicant names, application dates, dancer counts, phases, and expected host fees. Full rosters and results unlock after judging.</p>
        </div>
        {released ? (
          <a href="/api/comp/applicants/export" className="btn btn-primary">
            Download final team workbook
          </a>
        ) : null}
      </div>
      {!released ? (
        <p className="rounded-xl border border-line bg-blush p-5 text-sm">Tech admins verify OneLegends registration payments separately. Verify your competition payments before AV viewing. Viewing order, AV links, scores, and full team details remain hidden until results release.</p>
      ) : null}
      {!released ? <HostPaymentReview
        competitionId={competitionId}
        verified={Boolean(competition.compPaymentsVerifiedAt)}
        locked={competition.judgingOpen || competition.applications.some((application) => application.viewingPosition != null)}
        rows={competition.applications.map((application) => ({
          id: application.id,
          teamName: application.team.name,
          status: application.compPaymentReviewStatus,
          oneLegendsPaid: Boolean(application.team.registrationPaidAt),
        }))}
      /> : null}
      {released ? <CompDecisionBoard key={`${competition.decisionsSubmittedAt?.toISOString() ?? "draft"}-${decisionRows.map((row) => row.status).join("-")}`} rows={decisionRows} finalized={Boolean(competition.decisionsSubmittedAt)} /> : null}
      {competition.applications.length ? (
        <ul aria-label="Applied teams" className="divide-y divide-line rounded-xl border border-line bg-card">
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
                <p className="mt-1 text-sm font-medium">{application.appliedPhase ? `${applicationPhaseLabel(application.appliedPhase)} phase · Expected host fee: ${formatApplicationFee(application.expectedFeeCents)}` : "Phase and expected host fee were not recorded for this earlier application."}</p>
              </div>
              {released ? (
                <div className="space-y-2">
                  <span className="text-sm text-muted">{statusLabel(application.status)}</span>
                  {` · Host payment ${application.compPaymentReviewStatus === "LEGACY_INCLUDED" ? "unreviewed (historical viewing)" : application.compPaymentReviewStatus.toLowerCase()}`}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className="text-muted">No teams have applied.</p>}
    </div>
  );
}
