import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompetitionId, isCompAdmin } from "@/lib/team-access";
import { TeamDetails } from "@/components/TeamDetails";
import { visibleApplicationWhere } from "@/lib/payment-eligibility";
import { submittedApplicationAvUrl } from "@/lib/application-av";
import { hostCanViewApplicantDetails } from "@/lib/competition-type";

export default async function CompApplicantDetailsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const competitionId = await getActiveCompetitionId(session.user.id);
  if (!competitionId || !(await isCompAdmin(session.user.id, competitionId))) redirect("/comp");
  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    select: { resultsReleasedAt: true, isPartner: true, isAffiliate: true },
  });
  if (!competition || !hostCanViewApplicantDetails(competition)) notFound();
  const { teamId } = await params;
  const application = await prisma.application.findFirst({
    where: { teamId, competitionId, ...visibleApplicationWhere },
    include: {
      team: {
        include: {
          dancers: { orderBy: { name: "asc" } },
          memberships: {
            where: { status: "APPROVED", isAdmin: true },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            take: 1,
            select: { user: { select: { email: true } } },
          },
        },
      },
    },
  });
  if (!application) notFound();
  const contactEmail = application.team.memberships[0]?.user.email;
  return (
    <div className="space-y-7">
      <Link href="/comp/applicants" className="text-sm underline">← Applied teams</Link>
      <section className="rounded-xl border border-line bg-card p-6">
        <h2 className="font-heading text-2xl">Team contact</h2>
        {contactEmail ? (
          <a href={`mailto:${contactEmail}`} className="mt-2 inline-block text-accent underline">{contactEmail}</a>
        ) : (
          <p className="mt-2 text-sm text-muted">No approved team admin email is available.</p>
        )}
      </section>
      <TeamDetails team={{ ...application.team, avDriveUrl: submittedApplicationAvUrl(application) }} showIdsLink />
    </div>
  );
}
