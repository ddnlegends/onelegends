import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompetitionId, isCompAdmin } from "@/lib/team-access";
import { TeamDetails } from "@/components/TeamDetails";

export default async function CompApplicantDetailsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const competitionId = await getActiveCompetitionId(session.user.id);
  if (!competitionId || !(await isCompAdmin(session.user.id, competitionId))) redirect("/comp");
  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    select: { resultsReleasedAt: true },
  });
  if (!competition?.resultsReleasedAt) notFound();
  const { teamId } = await params;
  const application = await prisma.application.findUnique({
    where: { teamId_competitionId: { teamId, competitionId } },
    include: { team: { include: { dancers: { orderBy: { name: "asc" } } } } },
  });
  if (!application) notFound();
  return (
    <div className="space-y-7">
      <Link href="/comp/applicants" className="text-sm underline">← Applied teams</Link>
      <TeamDetails team={application.team} />
    </div>
  );
}
