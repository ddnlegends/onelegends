import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { formatDate, statusLabel } from "@/lib/utils";
import { teamProfileGaps, TEAM_APPLY_OPS_BLOCKED_MESSAGE } from "@/lib/team-profile";
import {
  getActiveTeamId,
  getApprovedTeamMemberships,
} from "@/lib/team-access";
import { setActiveTeamAction } from "@/app/actions/team-access";
import { InstantSelect } from "@/components/InstantSelect";
import { TeamPhoto } from "@/components/TeamPhoto";

export default async function TeamDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const memberships = await getApprovedTeamMemberships(userId);
  const activeTeamId = await getActiveTeamId(userId);
  if (!activeTeamId) redirect("/dashboard");

  const team = await prisma.teamProfile.findUnique({
    where: { id: activeTeamId },
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
        <div className="flex items-center gap-4">
          <TeamPhoto src={team.photoUrl} name={team.name || "Your team"} size="lg" />
          <div>
            <h1 className="font-heading text-4xl">{team.name || "Your team"}</h1>
            <p className="mt-2 text-muted">
              {team.applyBlocked
                ? "Circuit ops has blocked this team from applying."
                : gaps.length
                  ? "Keep one team profile. You cannot apply until every profile field and the dancer roster are filled in."
                  : "Ready to apply."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/team/profile" prefetch className="btn btn-ghost">
            Edit Team Profile
          </Link>
          <Link href="/team/access" prefetch className="btn btn-ghost">
            Admins
          </Link>
          {team.applyBlocked ? null : (
            <Link href={applyHref} prefetch className="btn btn-primary">
              {gaps.length ? "Finish profile to apply" : "Apply"}
            </Link>
          )}
        </div>
      </div>

      {memberships.length > 1 ? (
        <form action={setActiveTeamAction} className="flex flex-wrap items-end gap-3">
          <div className="field">
            <label htmlFor="active-team">Active team</label>
            <InstantSelect
              key={activeTeamId}
              id="active-team"
              name="teamId"
              defaultValue={activeTeamId}
            >
              {memberships.map((m) => (
                <option key={m.teamId} value={m.teamId}>
                  {m.team.name}
                </option>
              ))}
            </InstantSelect>
          </div>
          <button className="btn btn-ghost" type="submit">
            Switch
          </button>
        </form>
      ) : null}

      {team.applyBlocked ? (
        <p className="notice notice-error">{TEAM_APPLY_OPS_BLOCKED_MESSAGE}</p>
      ) : gaps.length ? (
        <p className="notice notice-error">
          Apply is locked until Team Profile is complete ({gaps.join(", ")}).
        </p>
      ) : null}

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-blush p-5">
        <div>
          <h2 className="font-heading text-xl">Payment instructions</h2>
          <p className="mt-1 text-sm text-muted">
            Include <strong>{team.name}&apos;s OneLegends Payment</strong> in the
            memo. Payment confirmation is handled manually.
          </p>
        </div>
        <Link href="/payments" className="btn btn-ghost">
          View instructions
        </Link>
      </section>

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
            <Link href={applyHref} className="underline">
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
