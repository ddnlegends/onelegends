import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TeamDetails } from "@/components/TeamDetails";

export default async function OpsTeamDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = await prisma.teamProfile.findUnique({
    where: { id },
    include: {
      dancers: { orderBy: { name: "asc" } },
      applications: { include: { competition: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!team) notFound();
  return (
    <div className="space-y-7">
      <Link href="/ops/teams" className="text-sm underline">← All teams</Link>
      {team.applyBlocked ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Applications blocked: {team.applyBlockReason || "No reason recorded"}</p> : null}
      <TeamDetails team={team} />
      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Competition applications</h2>
        {team.applications.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {team.applications.map((application) => (
              <li key={application.id} className="flex justify-between gap-4 px-4 py-3 text-sm">
                <span>{application.competition.name}</span><span>{application.status}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-muted">No applications yet.</p>}
      </section>
    </div>
  );
}
