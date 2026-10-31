import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { formatDate } from "@/lib/utils";
import { applicationPhaseLabel } from "@/lib/application-schedule";
import { formatApplicationFee } from "@/lib/competition-details";
import { teamProfileGaps, TEAM_APPLY_OPS_BLOCKED_MESSAGE } from "@/lib/team-profile";
import {
  getActiveTeamId,
  getApprovedTeamMemberships,
} from "@/lib/team-access";
import { setActiveTeamAction } from "@/app/actions/team-access";
import { InstantSelect } from "@/components/InstantSelect";
import { TeamPhoto } from "@/components/TeamPhoto";
import { WithdrawApplicationForm } from "@/components/WithdrawApplicationForm";
import { canTeamWithdrawApplication } from "@/lib/application-withdrawal";
import { offerStatusLabel, PARTNER_CONFIRMATION_LIMIT } from "@/lib/application-offers";

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
  const applyHref = "/team/apply";
  const now = new Date();
  const currentApplications = team.applications.filter((app) => !app.removedAt);
  const partnerConfirmed = currentApplications.filter((app) => app.competition.isPartner && !app.competition.isAffiliate && app.competition.decisionsSubmittedAt && app.teamOfferResponse === "CONFIRMED").length;
  const totalConfirmed = currentApplications.filter((app) => app.competition.decisionsSubmittedAt && app.teamOfferResponse === "CONFIRMED").length;
  const awaitingResponse = currentApplications.filter((app) => app.competition.decisionsSubmittedAt && app.status === "ACCEPTED" && app.teamOfferResponse === "NONE").length;

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
                  ? "Browse competitions now. Complete your profile before applying."
                  : "Ready to apply."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/team/decisions" className="btn btn-ghost">Decisions</Link>
          <Link href="/team/profile" className="btn btn-ghost">
            Edit Team Profile
          </Link>
          <Link href="/team/access" className="btn btn-ghost">
            Admins
          </Link>
          {team.applyBlocked ? null : (
            <Link href={applyHref} className="btn btn-primary">
              {gaps.length ? "Browse competitions" : "Apply"}
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

      <section className="rounded-xl border border-line bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-heading text-2xl">Competition decisions</h2><p className="mt-1 text-sm text-muted">Offers require your team to confirm a spot.</p></div>
          <Link href="/team/decisions" className="btn btn-primary">Review decisions</Link>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div><dt className="text-xs uppercase text-muted">Partner spots confirmed</dt><dd className="font-heading text-2xl">{partnerConfirmed} / {PARTNER_CONFIRMATION_LIMIT}</dd></div>
          <div><dt className="text-xs uppercase text-muted">Total confirmed</dt><dd className="font-heading text-2xl">{totalConfirmed}</dd></div>
          <div><dt className="text-xs uppercase text-muted">Offers to answer</dt><dd className="font-heading text-2xl">{awaitingResponse}</dd></div>
        </dl>
      </section>

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
                  <p className="text-xs text-muted">{app.appliedPhase ? `${applicationPhaseLabel(app.appliedPhase)} phase · Expected host fee: ${formatApplicationFee(app.expectedFeeCents)}` : "Phase and expected host fee were not recorded for this earlier application."}</p>
                  <Link href={`/team/applications/${app.id}`} className="mt-2 inline-block text-sm font-medium text-accent underline">Review application</Link>
                  {!app.removedAt ? (
                    <p className="text-xs text-muted">
                      {app.submittedAvDriveUrl ? "This competition's AV link stays fixed. " : "This earlier application uses your current AV link. "}
                      Profile and roster updates remain live.
                      {app.submittedAvDriveUrl ? <> <a href={app.submittedAvDriveUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline">View submitted AV</a></> : null}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-start gap-2">
                  <span className="text-sm">{app.removedAt ? app.removalReason === "Withdrawn by team" ? "Withdrawn" : "Removed" : offerStatusLabel({ ...app, decisionsSubmittedAt: app.competition.decisionsSubmittedAt })}</span>
                  {canTeamWithdrawApplication(app, now) ? (
                    <WithdrawApplicationForm applicationId={app.id} competitionName={app.competition.name} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
