import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdminPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";
import { currentApplicationWhere } from "@/lib/payment-eligibility";
import { competitionProfileGaps } from "@/lib/competition-profile";
import { teamProfileGaps } from "@/lib/team-profile";
import { regAvReviewStatus } from "@/lib/reg-tracking";
import { competitionStatus } from "@/lib/judging";
import { submittedApplicationAvUrl } from "@/lib/application-av";
import { parseDriveUrl } from "@/lib/drive";
import { RegAvReviewForm, RegFollowUpForm } from "@/components/RegForms";

export default async function RegCompetitionPage({ params }: { params: Promise<{ competitionId: string }> }) {
  const user = await requirePlatformAdminPage();
  const { competitionId } = await params;
  const comp = await prisma.competitionProfile.findFirst({
    where: { id: competitionId, isPartner: true, regAssignment: { email: user.email!.trim().toLowerCase() } },
    include: {
      regAssignment: true,
      applications: { where: currentApplicationWhere, include: { team: { include: { dancers: true } } }, orderBy: { createdAt: "asc" } },
      judgeAssignments: { where: { status: "APPROVED" }, select: { submittedAt: true } },
    },
  });
  if (!comp?.regAssignment) notFound();
  const assignment = comp.regAssignment;
  const profileGaps = competitionProfileGaps(comp);
  const review = regAvReviewStatus(assignment, comp.applications);
  const viewingStarted = comp.applications.some((app) => app.viewingPosition != null);
  const submittedJudges = comp.judgeAssignments.filter((judge) => judge.submittedAt).length;
  return <div className="space-y-8">
    <div><Link href="/ops/reg" className="text-sm text-accent underline">← My Partner Comps</Link>
      <h1 className="mt-3 font-heading text-4xl">{comp.name}</h1><p className="mt-2 text-muted">{comp.eventDate?.toLocaleDateString("en-US", { timeZone: "UTC" }) ?? "Date TBD"} · {competitionStatus(comp)} · {comp.location || "Location TBD"}</p></div>
    <section className="rounded-xl border border-line bg-card p-6 space-y-2"><h2 className="font-heading text-2xl">Competition readiness</h2>
      <p>Comp profile: {profileGaps.length ? `Missing ${profileGaps.join(", ")}` : "Complete"}</p>
      <p>OneLegends competition registration: {comp.registrationPaidAt ? "Paid" : "Not marked paid"}</p>
      <p>Host payment verification: {comp.compPaymentsVerifiedAt ? "Verified" : "Not verified"}</p>
      <p>Viewing: {viewingStarted ? "Started" : "Not started"} · Judge packets: {submittedJudges}/{comp.judgeAssignments.length} submitted · Results: {comp.resultsReleasedAt ? "Released" : "Not released"}</p>
      <Link href={`/ops/comps/${comp.id}`} className="text-sm text-accent underline">Open live dashboard</Link>
    </section>
    <section className="space-y-3"><div><h2 className="font-heading text-2xl">Applied teams ({comp.applications.length})</h2>
      <p className="text-sm text-muted">OneLegends dues and payment to the competition host are separate checks. An AV link alone does not mean it was reviewed.</p></div>
      {!comp.applications.length ? <p className="text-muted">No active applications.</p> : <div className="space-y-3">{comp.applications.map((app) => {
        const gaps = teamProfileGaps(app.team);
        const avUrl = submittedApplicationAvUrl(app);
        const avFile = parseDriveUrl(avUrl)?.kind === "file";
        return <article key={app.id} className="rounded-xl border border-line bg-card p-5 space-y-1 text-sm">
          <h3 className="font-heading text-xl">{app.team.name}</h3>
          <p>Application: {app.status} · Profile: {gaps.length ? `Missing ${gaps.join(", ")}` : "Complete"}</p>
          <p>OneLegends team payment: {app.team.registrationPaidAt ? "Paid" : "Not marked paid"} · Host payment: {app.compPaymentReviewStatus}</p>
          <p>AV: {avFile ? <a href={avUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline">Open submitted video</a> : avUrl ? "Link needs a Google Drive file URL" : "Missing"} · Viewing position: {app.viewingPosition ?? "Not assigned"}</p>
        </article>;
      })}</div>}
    </section>
    <section className="rounded-xl border border-line bg-card p-6 space-y-3"><h2 className="font-heading text-2xl">AV review</h2>
      <p>Status: {review === "current" ? "Reviewed" : review === "stale" ? "Needs another review: applications or AV links changed" : "Not reviewed"}</p>
      {assignment.avReviewedAt && <p className="text-sm text-muted">Last marked reviewed: {assignment.avReviewedAt.toLocaleString("en-US")}</p>}
      <RegAvReviewForm competitionId={comp.id} />
    </section>
    <section className="rounded-xl border border-line bg-card p-6 space-y-3"><h2 className="font-heading text-2xl">Follow-up</h2>
      <p className="text-sm text-muted">Last contact: {assignment.lastContactAt?.toLocaleString("en-US") ?? "Not recorded"}</p>
      <RegFollowUpForm competitionId={comp.id} note={assignment.followUpNote} />
    </section>
  </div>;
}
