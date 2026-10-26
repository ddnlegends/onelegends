import Link from "next/link";
import { requirePlatformAdminPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";
import { currentApplicationWhere } from "@/lib/payment-eligibility";
import { competitionProfileGaps } from "@/lib/competition-profile";
import { teamProfileGaps } from "@/lib/team-profile";
import { regAvReviewStatus } from "@/lib/reg-tracking";
import { competitionStatus } from "@/lib/judging";
import { submittedApplicationAvUrl } from "@/lib/application-av";
import { parseDriveUrl } from "@/lib/drive";

export default async function MyPartnerCompsPage() {
  const user = await requirePlatformAdminPage();
  const assignments = await prisma.competitionRegAssignment.findMany({
    where: { email: user.email!.trim().toLowerCase(), competition: { isPartner: true } },
    include: { competition: { include: { applications: {
      where: currentApplicationWhere,
      include: { team: { include: { dancers: true } } },
    } } } },
    orderBy: [{ competition: { eventDate: "asc" } }, { competition: { name: "asc" } }],
  });
  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div>
      <h1 className="font-heading text-4xl">My Partner Comps</h1>
      <p className="mt-2 text-muted">Your Reg chair assignments and the checks that need attention.</p>
    </div><Link href="/ops/reg/assignments" className="btn btn-ghost">Manage assignments</Link></div>
    {!assignments.length ? <div className="rounded-xl border border-line bg-card p-6">No comp assigned.</div> :
      <div className="space-y-4">{assignments.map((assignment) => {
        const comp = assignment.competition;
        const apps = comp.applications;
        const profileGaps = competitionProfileGaps(comp);
        const incompleteTeams = apps.filter((app) => teamProfileGaps(app.team).length).length;
        const avLinkIssues = apps.filter((app) => parseDriveUrl(submittedApplicationAvUrl(app))?.kind !== "file").length;
        const paidCircuit = apps.filter((app) => app.team.registrationPaidAt).length;
        const paidHost = apps.filter((app) => ["PAID", "WAIVED"].includes(app.compPaymentReviewStatus)).length;
        const review = regAvReviewStatus(assignment, apps);
        return <Link href={`/ops/reg/${comp.id}`} key={comp.id} className="block rounded-xl border border-line bg-card p-5 transition hover:border-accent/40 hover:shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-heading text-2xl">{comp.name}</h2><span className="text-sm text-muted">{comp.eventDate?.toLocaleDateString("en-US", { timeZone: "UTC" }) ?? "Date TBD"}</span></div>
          <p className="mt-2 text-sm text-muted">{competitionStatus(comp)} · Comp profile: {profileGaps.length ? `${profileGaps.length} gaps` : "ready"} · Team profiles: {incompleteTeams} incomplete</p>
          <p className="mt-1 text-sm text-muted">OneLegends team payment: {paidCircuit}/{apps.length} · Host payment: {paidHost}/{apps.length} · AV link issues: {avLinkIssues} · AV review: {review}</p>
          <span className="mt-3 inline-block text-sm font-semibold text-accent">Open Reg tracker →</span>
        </Link>;
      })}</div>}
  </div>;
}
