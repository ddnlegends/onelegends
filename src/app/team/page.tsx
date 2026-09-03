import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { formatDate, statusLabel } from "@/lib/utils";
import { teamProfileGaps } from "@/lib/team-profile";

export default async function TeamDashboardPage() {
  const session = await auth();
  const team = await prisma.teamProfile.findUnique({
    where: { userId: session!.user.id },
    include: {
      applications: {
        include: { competition: true },
        orderBy: { createdAt: "desc" },
      },
      dancers: true,
    },
  });

  if (!team) return null;

  const gaps = teamProfileGaps(team);
  const applyHref = gaps.length ? "/team/profile" : "/team/apply";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-4xl">{team.name || "Your team"}</h1>
          <p className="mt-2 text-muted">
            Keep one team profile. You cannot apply until every profile field
            and the dancer roster are filled in.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/team/profile" className="btn btn-ghost">
            Edit Team Profile
          </Link>
          <Link href={applyHref} className="btn btn-primary">
            {gaps.length ? "Finish profile to apply" : "Apply"}
          </Link>
        </div>
      </div>

      {gaps.length ? (
        <p className="notice notice-error">
          Apply is locked until Team Profile is complete ({gaps.join(", ")}).
        </p>
      ) : null}

      <dl className="grid gap-4 rounded-xl border border-line bg-card p-6 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Captains</dt>
          <dd className="mt-1">{team.captains || "Add captains"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Years</dt>
          <dd className="mt-1">{team.yearsEstablished ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Roster</dt>
          <dd className="mt-1">{team.rosterSize ?? team.dancers.length}</dd>
        </div>
      </dl>

      <section>
        <h2 className="mb-3 font-heading text-2xl">Your applications</h2>
        {team.applications.length === 0 ? (
          <p className="text-muted">
            None yet.{" "}
            <Link href="/team/apply" className="underline">
              Apply to comps
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {team.applications.map((app) => (
              <li key={app.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <Link href={`/comps/${app.competition.id}`} className="font-medium hover:underline">
                    {app.competition.name}
                  </Link>
                  <p className="text-sm text-muted">
                    Applied {formatDate(app.createdAt)}
                    {app.competition.dates ? ` · ${app.competition.dates}` : ""}
                  </p>
                </div>
                <span className="text-sm">{statusLabel(app.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
