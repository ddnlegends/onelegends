import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompetitionId, isCompAdmin } from "@/lib/team-access";

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
      applications: { orderBy: { createdAt: "asc" }, include: { team: { select: { id: true, name: true, captains: true, rosterSize: true, _count: { select: { dancers: true } } } } } },
    },
  });
  if (!competition) redirect("/comp");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl">Applied teams</h1>
        <p className="mt-2 text-muted">{competition.name} · Full rosters and details unlock when judging results are released.</p>
      </div>
      {!competition.resultsReleasedAt ? (
        <p className="rounded-xl border border-line bg-blush p-5 text-sm">Team identities and rosters are sealed until the required judges submit and results release.</p>
      ) : competition.applications.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {competition.applications.map((application) => (
            <li key={application.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <Link href={`/comp/applicants/${application.team.id}`} className="font-semibold hover:underline">{application.team.name}</Link>
                <p className="text-sm text-muted">{application.team.captains || "Captains TBA"} · {application.team.rosterSize ?? application.team._count.dancers} dancers</p>
              </div>
              <span className="text-sm text-muted">{application.status}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-muted">No teams have applied.</p>}
    </div>
  );
}
