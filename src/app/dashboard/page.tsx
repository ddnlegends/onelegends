import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPendingInvites } from "@/lib/invites";
import { formatDate, formatDateTime, statusLabel } from "@/lib/utils";
import { isCompetitionOpen } from "@/lib/judging";
import { teamProfileGaps, TEAM_APPLY_OPS_BLOCKED_MESSAGE } from "@/lib/team-profile";
import {
  getActiveCompetitionId,
  getActiveTeamId,
  getApprovedCompMemberships,
  getApprovedTeamMemberships,
  isPlatformAdmin,
  userHasJudgeAccess,
} from "@/lib/team-access";
import {
  setActiveCompAction,
  setActiveTeamAction,
} from "@/app/actions/team-access";
import {
  AcceptCompInviteForm,
  AcceptJudgeInviteForm,
  AcceptTeamInviteForm,
  CreateTeamForm,
  InviteCompAdminForm,
  InviteTeamAdminForm,
  ResetCompClaimForm,
  ResetTeamClaimForm,
  SetTeamApplyBlockForm,
  RevokeCompAccessForm,
  RevokeTeamAccessForm,
  CancelCompInviteForm,
  CancelTeamInviteForm,
} from "@/components/AccountForms";
import { ApplyForm } from "@/components/ApplyForm";
import { TeamPhoto } from "@/components/TeamPhoto";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;
  const email = session!.user.email ?? "";
  const name = session!.user.name ?? "";
  const ops = await isPlatformAdmin(userId);
  if (ops) {
    return <OpsDashboard email={email} name={name} userId={userId} />;
  }

  const pending = await getPendingInvites(userId, email);
  const teamMemberships = await getApprovedTeamMemberships(userId);
  const compMemberships = await getApprovedCompMemberships(userId);
  const judging = await userHasJudgeAccess(userId);
  const activeTeamId = await getActiveTeamId(userId);
  const activeCompId = await getActiveCompetitionId(userId);

  const team = activeTeamId
    ? await prisma.teamProfile.findUnique({
        where: { id: activeTeamId },
        include: {
          applications: {
            include: { competition: true },
            orderBy: { createdAt: "desc" },
          },
          dancers: true,
        },
      })
    : null;

  const competition = activeCompId
    ? await prisma.competitionProfile.findUnique({
        where: { id: activeCompId },
        include: {
          applications: true,
          judgeAssignments: {
            where: { status: "APPROVED" },
            select: { submittedAt: true },
          },
        },
      })
    : null;

  const judge = judging
    ? await prisma.judgeProfile.findUnique({
        where: { userId },
        include: {
          assignments: {
            where: { status: "APPROVED" },
            include: { competition: { select: { id: true, name: true } } },
            orderBy: { requestedAt: "desc" },
          },
        },
      })
    : null;

  const claimedComps = team
    ? await prisma.competitionProfile.findMany({
        where: { claimedAt: { not: null } },
        orderBy: [{ eventDate: "desc" }, { name: "asc" }],
      })
    : [];

  const gaps = team ? teamProfileGaps(team) : [];
  const applied = new Set(team?.applications.map((a) => a.competitionId) ?? []);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-heading text-4xl">Dashboard</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Your home in OneLegends. Profiles, applications, and judging all
          start here.
        </p>
      </div>

      <section className="rounded-xl border border-line bg-card p-6">
        <h2 className="font-heading text-xl">Your account</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Name</dt>
            <dd className="mt-1">{name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Email</dt>
            <dd className="mt-1">{email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Access</dt>
            <dd className="mt-1 text-sm text-muted">
              {[
                team ? `Team · ${team.name}` : null,
                competition ? `Competition · ${competition.name}` : null,
                judging ? "Judge" : null,
              ]
                .filter(Boolean)
                .join(" · ") || "None yet"}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/profile" className="btn btn-ghost">
            Profile
          </Link>
          {!team && !competition && !judging ? (
            <Link href="/claim" className="btn btn-primary">
              Code Claim
            </Link>
          ) : (
            <Link href="/claim" className="btn btn-ghost">
              Code Claim
            </Link>
          )}
        </div>
        {!team && !competition && !judging ? (
          <p className="mt-3 text-sm text-muted">
            You are not on a team or competition yet. Use Code Claim, or wait
            for an invite on this email.
          </p>
        ) : null}
      </section>

      {pending.teams.length || pending.comps.length || pending.judges.length ? (
        <section className="space-y-4">
          <h2 className="font-heading text-2xl">Requests</h2>
          {pending.teams.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3"
            >
              <span className="font-medium">Team · {row.team.name}</span>
              <AcceptTeamInviteForm membershipId={row.id} />
            </div>
          ))}
          {pending.comps.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3"
            >
              <span className="font-medium">
                Competition · {row.competition.name}
              </span>
              <AcceptCompInviteForm membershipId={row.id} />
            </div>
          ))}
          {pending.judges.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3"
            >
              <span className="font-medium">Judge · {row.competition.name}</span>
              <AcceptJudgeInviteForm inviteId={row.id} />
            </div>
          ))}
        </section>
      ) : null}

      {team ? (
        <section className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-4">
              <TeamPhoto src={team.photoUrl} name={team.name} size="md" />
              <div>
                <h2 className="font-heading text-2xl">{team.name}</h2>
                <p className="mt-1 text-sm text-muted">
                  {team.applyBlocked
                    ? "Blocked from applying."
                    : gaps.length
                      ? "Fill the profile, then you can apply to competitions."
                      : "Ready to apply."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/team/profile" className="btn btn-ghost">
                Team Profile
              </Link>
              <Link href="/team/access" className="btn btn-ghost">
                Admins
              </Link>
            </div>
          </div>

          {teamMemberships.length > 1 ? (
            <form action={setActiveTeamAction} className="flex flex-wrap items-end gap-3">
              <div className="field">
                <label htmlFor="active-team">Active team</label>
                <select id="active-team" name="teamId" defaultValue={team.id}>
                  {teamMemberships.map((m) => (
                    <option key={m.teamId} value={m.teamId}>
                      {m.team.name}
                    </option>
                  ))}
                </select>
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
              Apply is locked until Team Profile is complete ({gaps.join(", ")}
              ).
            </p>
          ) : (
            <div className="space-y-3">
              <h3 className="font-heading text-xl">Apply to competitions</h3>
              {claimedComps.length === 0 ? (
                <p className="text-sm text-muted">
                  No comps available to apply.
                </p>
              ) : (
                <ApplyForm
                  competitions={claimedComps.map((c) => ({
                    id: c.id,
                    name: c.name,
                    dates: c.dates,
                    location: c.location,
                    venue: c.venue,
                    deadline: c.applicationDeadline
                      ? formatDateTime(c.applicationDeadline)
                      : undefined,
                    acceptingApps: isCompetitionOpen(c),
                    alreadyApplied: applied.has(c.id),
                  }))}
                />
              )}
            </div>
          )}

          <div>
            <h3 className="mb-3 font-heading text-xl">Your applications</h3>
            {team.applications.length === 0 ? (
              <p className="text-muted">None yet.</p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line bg-card">
                {team.applications.map((app) => (
                  <li
                    key={app.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium">{app.competition.name}</p>
                      <p className="text-sm text-muted">
                        Applied {formatDate(app.createdAt)}
                      </p>
                    </div>
                    <span className="text-sm">{statusLabel(app.status)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {competition ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-heading text-2xl">{competition.name}</h2>
              <p className="mt-1 text-sm text-muted">
                {isCompetitionOpen(competition)
                  ? "Accepting applications."
                  : "Applications closed."}{" "}
                Team names stay sealed until judging is complete.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/comp/profile" className="btn btn-ghost">
                Comp Details
              </Link>
              <Link href="/comp/judges" className="btn btn-ghost">
                Judges
              </Link>
              <Link href="/comp/results" className="btn btn-primary">
                Viewing Results
              </Link>
              <Link href="/comp/access" className="btn btn-ghost">
                Admins
              </Link>
            </div>
          </div>
          {compMemberships.length > 1 ? (
            <form action={setActiveCompAction} className="flex flex-wrap items-end gap-3">
              <div className="field">
                <label htmlFor="active-comp">Active competition</label>
                <select
                  id="active-comp"
                  name="competitionId"
                  defaultValue={competition.id}
                >
                  {compMemberships.map((m) => (
                    <option key={m.competitionId} value={m.competitionId}>
                      {m.competition.name}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-ghost" type="submit">
                Switch
              </button>
            </form>
          ) : null}
          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-card p-5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                Applications
              </dt>
              <dd className="mt-2 font-heading text-3xl text-accent">
                {competition.applications.length}
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-card p-5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                Judges submitted
              </dt>
              <dd className="mt-2 font-heading text-3xl text-accent">
                {competition.judgeAssignments.filter((a) => a.submittedAt).length}
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-card p-5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                Required judges
              </dt>
              <dd className="mt-2 font-heading text-3xl text-accent">
                {competition.requiredJudgeCount}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {judge ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-heading text-2xl">Judging</h2>
            <Link href="/judge" className="btn btn-primary">
              Open Judging
            </Link>
          </div>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {judge.assignments.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <span className="font-medium">{row.competition.name}</span>
                <Link
                  href={`/judge/${row.competitionId}`}
                  className="text-sm text-accent underline"
                >
                  {row.submittedAt ? "Review packet" : "Open packet"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

async function OpsDashboard({
  email,
  name,
  userId,
}: {
  email: string;
  name: string;
  userId: string;
}) {
  const teams = await prisma.teamProfile.findMany({
    orderBy: { name: "asc" },
    include: {
      memberships: {
        include: { user: { select: { id: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      invites: { orderBy: { createdAt: "desc" } },
      applications: {
        include: { competition: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  const comps = await prisma.competitionProfile.findMany({
    orderBy: { name: "asc" },
    include: {
      memberships: {
        include: { user: { select: { id: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      invites: { orderBy: { createdAt: "desc" } },
      applications: {
        include: { team: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-heading text-4xl">Circuit ops</h1>
        <p className="mt-2 max-w-2xl text-muted">
          This login does not claim a team or competition. Create teams, hand
          out claim codes, and oversee every listing’s admins and application
          statuses.
        </p>
      </div>

      <section className="rounded-xl border border-line bg-card p-6">
        <h2 className="font-heading text-xl">Your account</h2>
        <p className="mt-2">{name || email}</p>
        {name ? <p className="text-sm text-muted">{email}</p> : null}
        <p className="text-sm text-muted">Legends Admin · platform access</p>
        <Link href="/profile" className="btn btn-ghost mt-4">
          Profile
        </Link>
      </section>

      <CreateTeamForm />

      <section className="space-y-4">
        <h2 className="font-heading text-2xl">Teams</h2>
        {teams.length === 0 ? (
          <p className="text-muted">No teams yet. Add the first one above.</p>
        ) : (
          <div className="space-y-6">
            {teams.map((team) => (
              <article
                id={`ops-team-${team.id}`}
                key={team.id}
                className="space-y-4 rounded-xl border border-line bg-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-xl">{team.name}</h3>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">
                      Claim code
                    </p>
                    <p className="font-mono text-sm text-accent">{team.claimCode}</p>
                    <p className="text-sm text-muted">
                      {team.claimedAt ? "Claimed" : "Unclaimed"}
                      {team.applyBlocked ? " · Blocked from applying" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SetTeamApplyBlockForm
                      teamId={team.id}
                      teamName={team.name}
                      blocked={team.applyBlocked}
                    />
                    {team.claimedAt ? (
                      <ResetTeamClaimForm teamId={team.id} teamName={team.name} />
                    ) : null}
                  </div>
                </div>
                {team.claimedAt ? (
                  <InviteTeamAdminForm teamId={team.id} />
                ) : null}
                {(() => {
                  const approved = team.memberships.filter(
                    (row) => row.status === "APPROVED",
                  );
                  const pendingMembers = team.memberships.filter(
                    (row) => row.status === "PENDING",
                  );
                  return (
                    <>
                      {team.invites.length || pendingMembers.length ? (
                        <div>
                          <h4 className="mb-2 text-sm font-semibold">
                            Request sent
                          </h4>
                          <ul className="divide-y divide-line rounded-lg border border-line">
                            {team.invites.map((invite) => (
                              <li
                                key={invite.id}
                                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                              >
                                <span className="text-sm">
                                  {invite.email}
                                  <span className="text-muted">
                                    {" "}
                                    · waiting to create an account
                                  </span>
                                </span>
                                <CancelTeamInviteForm inviteId={invite.id} />
                              </li>
                            ))}
                            {pendingMembers.map((row) => (
                              <li
                                key={row.id}
                                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                              >
                                <span className="text-sm">
                                  {row.user.email}
                                  <span className="text-muted">
                                    {" "}
                                    · waiting to approve
                                  </span>
                                </span>
                                <RevokeTeamAccessForm membershipId={row.id} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <div>
                        <h4 className="mb-2 text-sm font-semibold">Admins</h4>
                        {approved.length === 0 ? (
                          <p className="text-sm text-muted">None yet.</p>
                        ) : (
                          <ul className="divide-y divide-line rounded-lg border border-line">
                            {approved.map((row) => (
                              <li
                                key={row.id}
                                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                              >
                                <span className="text-sm">
                                  {row.user.email}
                                  {row.isPrimary ? " · Primary" : " · Secondary"}
                                </span>
                                {!row.isPrimary && row.userId !== userId ? (
                                  <RevokeTeamAccessForm membershipId={row.id} />
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </>
                  );
                })()}
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Applications</h4>
                  {team.applications.length === 0 ? (
                    <p className="text-sm text-muted">No applications yet.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {team.applications.map((app) => (
                        <li key={app.id} className="flex justify-between gap-3">
                          <span>{app.competition.name}</span>
                          <span>{statusLabel(app.status)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-2xl">Competitions</h2>
        <div className="space-y-6">
          {comps.map((comp) => {
            const pending = comp.applications.filter((a) => a.status === "PENDING").length;
            const accepted = comp.applications.filter((a) => a.status === "ACCEPTED").length;
            const waitlisted = comp.applications.filter((a) => a.status === "WAITLISTED").length;
            const declined = comp.applications.filter((a) => a.status === "DECLINED").length;
            return (
              <article
                key={comp.id}
                className="space-y-4 rounded-xl border border-line bg-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-xl">{comp.name}</h3>
                    <p className="font-mono text-sm text-accent">{comp.claimCode}</p>
                    <p className="text-sm text-muted">
                      {comp.claimedAt ? "Claimed" : "Unclaimed · not in team Apply"}
                    </p>
                  </div>
                  {comp.claimedAt ? (
                    <ResetCompClaimForm
                      competitionId={comp.id}
                      competitionName={comp.name}
                    />
                  ) : null}
                </div>
                {comp.claimedAt ? <InviteCompAdminForm competitionId={comp.id} /> : null}
                {(() => {
                  const approved = comp.memberships.filter(
                    (row) => row.status === "APPROVED",
                  );
                  const pendingMembers = comp.memberships.filter(
                    (row) => row.status === "PENDING",
                  );
                  return (
                    <>
                      {comp.invites.length || pendingMembers.length ? (
                        <div>
                          <h4 className="mb-2 text-sm font-semibold">
                            Request sent
                          </h4>
                          <ul className="divide-y divide-line rounded-lg border border-line">
                            {comp.invites.map((invite) => (
                              <li
                                key={invite.id}
                                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                              >
                                <span className="text-sm">
                                  {invite.email}
                                  <span className="text-muted">
                                    {" "}
                                    · waiting to create an account
                                  </span>
                                </span>
                                <CancelCompInviteForm inviteId={invite.id} />
                              </li>
                            ))}
                            {pendingMembers.map((row) => (
                              <li
                                key={row.id}
                                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                              >
                                <span className="text-sm">
                                  {row.user.email}
                                  <span className="text-muted">
                                    {" "}
                                    · waiting to approve
                                  </span>
                                </span>
                                <RevokeCompAccessForm membershipId={row.id} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <div>
                        <h4 className="mb-2 text-sm font-semibold">Admins</h4>
                        {approved.length === 0 ? (
                          <p className="text-sm text-muted">None yet.</p>
                        ) : (
                          <ul className="divide-y divide-line rounded-lg border border-line">
                            {approved.map((row) => (
                              <li
                                key={row.id}
                                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                              >
                                <span className="text-sm">
                                  {row.user.email}
                                  {row.isPrimary ? " · Primary" : " · Secondary"}
                                </span>
                                {!row.isPrimary && row.userId !== userId ? (
                                  <RevokeCompAccessForm membershipId={row.id} />
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </>
                  );
                })()}
                <p className="text-sm text-muted">
                  Pending {pending} · Accepted {accepted} · Waitlisted {waitlisted}{" "}
                  · Declined {declined}
                </p>
                {comp.applications.length ? (
                  <ul className="space-y-1 text-sm">
                    {comp.applications.map((app) => (
                      <li key={app.id} className="flex justify-between gap-3">
                        <span>{app.team.name}</span>
                        <span>{statusLabel(app.status)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">No applications yet.</p>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
