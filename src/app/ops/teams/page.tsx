import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TeamPhoto } from "@/components/TeamPhoto";

export default async function OpsTeamsPage() {
  const teams = await prisma.teamProfile.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { dancers: true, applications: true } } },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl">All registered teams</h1>
        <p className="mt-2 text-muted">Circuit tech admins can open every team’s profile, roster, AV, and hospitality details.</p>
      </div>
      <div className="rounded-xl border border-line bg-card px-5 py-4 text-sm">
        {teams.length} teams registered · {teams.filter((team) => team.applyBlocked).length} blocked from applying
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line bg-card">
        {teams.map((team) => (
          <li key={team.id} className="flex items-center gap-4 px-4 py-3">
            <TeamPhoto src={team.photoUrl} name={team.name} size="sm" />
            <div className="min-w-0 flex-1">
              <Link href={`/ops/teams/${team.id}`} className="font-semibold hover:underline">{team.name}</Link>
              <p className="text-sm text-muted">{team._count.dancers} rostered dancers · {team._count.applications} applications · {team.claimedAt ? "Claimed" : "Unclaimed"}</p>
              {team.applyBlocked ? <p className="text-sm text-red-700">Applications blocked: {team.applyBlockReason || "No reason recorded"}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
