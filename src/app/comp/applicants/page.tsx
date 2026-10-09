import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompetitionId, isCompAdmin } from "@/lib/team-access";
import { formatDate, statusLabel } from "@/lib/utils";

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
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          status: true,
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
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl">Applied teams</h1>
        <p className="mt-2 text-muted">{competition.name} · See who applied to reconcile payments. Full rosters and results unlock after judging.</p>
      </div>
      {!released ? (
        <p className="rounded-xl border border-line bg-blush p-5 text-sm">Payment checks are manual. Viewing order, AV links, scores, and full team details remain hidden until results release.</p>
      ) : null}
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
              {released ? <span className="text-sm text-muted">{statusLabel(application.status)}</span> : null}
            </li>
          ))}
        </ul>
      ) : <p className="text-muted">No teams have applied.</p>}
    </div>
  );
}
