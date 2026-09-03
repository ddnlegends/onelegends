import { PageShell } from "@/components/PageShell";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dashboardPath } from "@/lib/roles";

export default async function TeamsDirectoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TEAM") redirect(dashboardPath(session.user.role));

  const teams = await prisma.teamProfile.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { dancers: true, applications: true } } },
  });

  return (
    <PageShell>
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl">Teams</h1>
        <p className="mt-2 text-muted">
          Competitions can open a team for AV, wiki, roster, and hospitality
          details. Dietary and shirt sizes are on each team page for comps.
        </p>
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line bg-card">
        {teams.map((team) => (
          <li key={team.id} className="flex items-center gap-4 px-4 py-3">
            {team.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={team.photoUrl}
                alt=""
                className="h-14 w-14 rounded-md object-cover"
              />
            ) : (
              <div className="h-14 w-14 rounded-md bg-line" />
            )}
            <div className="min-w-0 flex-1">
              <Link href={`/teams/${team.id}`} className="font-medium hover:underline">
                {team.name}
              </Link>
              <p className="truncate text-sm text-muted">
                {team.captains ? `Captains: ${team.captains}` : "Captains TBA"} ·{" "}
                {team.rosterSize ?? team._count.dancers} dancers
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
    </PageShell>
  );
}
