import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPendingInvites } from "@/lib/invites";
import { formatDate, formatDateTime, statusLabel } from "@/lib/utils";
import { isCompetitionOpen, isJudgingOpen } from "@/lib/judging";
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
  CancelRegistrationInviteForm,
  GrantRegistrationForm,
  RemoveRegistrationAccessForm,
  AcceptJudgeInviteForm,
  AcceptTeamInviteForm,
  CreateCompForm,
  CreateTeamForm,
  InviteCompAdminForm,
  InviteTeamAdminForm,
  InvitePlatformAdminForm,
  CancelPlatformAdminInviteForm,
  RevokePlatformAdminForm,
  ResetCompClaimForm,
  ResetTeamClaimForm,
  SetTeamApplyBlockForm,
  RevokeCompAccessForm,
  RevokeTeamAccessForm,
  CancelCompInviteForm,
  CancelTeamInviteForm,
} from "@/components/AccountForms";
import { ApplyForm } from "@/components/ApplyForm";
import { InstantSelect } from "@/components/InstantSelect";
import { TeamPhoto } from "@/components/TeamPhoto";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const email = session.user.email ?? "";
  const name = session.user.name ?? "";
  const ops = await isPlatformAdmin(userId);
  if (ops) {
    return <OpsDashboard email={email} name={name} userId={userId} />;
  }

  const [pending, teamMemberships, compMemberships, judging] = await Promise.all([
    getPendingInvites(userId, email),
    getApprovedTeamMemberships(userId),
    getApprovedCompMemberships(userId),
    userHasJudgeAccess(userId),
  ]);
  const [activeTeamId, activeCompId] = await Promise.all([
    getActiveTeamId(userId),
    getActiveCompetitionId(userId),
  ]);

  const [team, competition, judge] = await Promise.all([
    activeTeamId
      ? prisma.teamProfile.findUnique({
          where: { id: activeTeamId },
          include: {
            applications: {
              include: { competition: true },
              orderBy: { createdAt: "desc" },
            },
            dancers: true,
          },
        })
      : Promise.resolve(null),
    activeCompId
      ? prisma.competitionProfile.findUnique({
          where: { id: activeCompId },
          include: {
            applications: true,
            judgeAssignments: {
              where: { status: "APPROVED" },
              select: { submittedAt: true },
            },
          },
        })
      : Promise.resolve(null),
    judging
      ? prisma.judgeProfile.findUnique({
          where: { userId },
          include: {
            assignments: {
              where: { status: "APPROVED" },
              include: {
                competition: {
                  select: {
                    id: true,
                    name: true,
                    acceptingApps: true,
                    applicationDeadline: true,
                    judgingOpen: true,
                  },
                },
              },
              orderBy: { requestedAt: "desc" },
            },
          },
        })
      : Promise.resolve(null),
  ]);

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
              <Link href="/team/profile" prefetch className="btn btn-ghost">
                Team Profile
              </Link>
              <Link href="/team/access" prefetch className="btn btn-ghost">
                Admins
              </Link>
            </div>
          </div>

          {teamMemberships.length > 1 ? (
            <form action={setActiveTeamAction} className="flex flex-wrap items-end gap-3">
              <div className="field">
                <label htmlFor="active-team">Active team</label>
                <InstantSelect
                  key={team.id}
                  id="active-team"
                  name="teamId"
                  defaultValue={team.id}
                >
                  {teamMemberships.map((m) => (
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
              <Link href="/comp/profile" prefetch className="btn btn-ghost">
                Comp Details
              </Link>
              <Link href="/comp/judges" prefetch className="btn btn-ghost">
                Judges
              </Link>
              <Link href="/comp/results" prefetch className="btn btn-primary">
                Viewing Results
              </Link>
              <Link href="/comp/access" prefetch className="btn btn-ghost">
                Admins
              </Link>
            </div>
          </div>
          {compMemberships.length > 1 ? (
            <form action={setActiveCompAction} className="flex flex-wrap items-end gap-3">
              <div className="field">
                <label htmlFor="active-comp">Active competition</label>
                <InstantSelect
                  key={competition.id}
                  id="active-comp"
                  name="competitionId"
                  defaultValue={competition.id}
                >
                  {compMemberships.map((m) => (
                    <option key={m.competitionId} value={m.competitionId}>
                      {m.competition.name}
                    </option>
                  ))}
                </InstantSelect>
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
                {row.submittedAt ? (
                  <Link
                    href={`/judge/${row.competitionId}`}
                    className="text-sm text-accent underline"
                  >
                    Review packet
                  </Link>
                ) : isCompetitionOpen(row.competition) ? (
                  <span className="text-sm text-muted">Waiting for apps to close</span>
                ) : isJudgingOpen(row.competition) ? (
                  <Link
                    href={`/judge/${row.competitionId}`}
                    className="text-sm text-accent underline"
                  >
                    Open packet
                  </Link>
                ) : (
                  <span className="text-sm text-muted">Waiting for judging to open</span>
                )}
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
  const [teams, comps, techAdmins, techInvites, regAccess, regInvites] = await Promise.all([
    prisma.teamProfile.findMany({
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
    }),
    prisma.competitionProfile.findMany({
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
      judgeAssignments: {
        where: { status: "APPROVED" },
        select: { submittedAt: true },
      },
    },
    }),
    prisma.user.findMany({
      where: { platformAdmin: true },
      select: { id: true, email: true, name: true },
      orderBy: { email: "asc" },
    }),
    prisma.platformAdminInvite.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.registrationAccess.findMany({
      include: {
        user: { select: { email: true } },
        competition: { select: { name: true } },
      },
      orderBy: [{ competition: { name: "asc" } }, { createdAt: "asc" }],
    }),
    prisma.registrationInvite.findMany({
      include: { competition: { select: { name: true } } },
      orderBy: [{ competition: { name: "asc" } }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-heading text-4xl">Circuit ops</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Traffic for every listing at once. Invite tech admins, grant REG
          access, and follow live judging from Comp Dashboard.
        </p>
      </div>

      <Link
        href="/ops/comps"
        prefetch
        className="brand-gradient group flex flex-wrap items-center justify-between gap-4 rounded-2xl px-6 py-5 text-white shadow-sm transition hover:brightness-110"
      >
        <div>
          <p className="text-xs uppercase tracking-widest text-white/80">
            Live judging
          </p>
          <p className="font-heading text-2xl tracking-wide">Comp Dashboard</p>
          <p className="mt-1 text-sm text-white/85">
            Every competition at a glance, with the team on screen and each
            judge’s scores as they come in.
          </p>
        </div>
        <span className="rounded-full border border-white/40 px-4 py-2 text-sm font-semibold transition group-hover:bg-white group-hover:text-accent">
          Open
        </span>
      </Link>

      <section className="rounded-xl border border-line bg-card p-6">
        <h2 className="font-heading text-xl">Your account</h2>
        <p className="mt-2">{name || email}</p>
        {name ? <p className="text-sm text-muted">{email}</p> : null}
        <p className="text-sm text-muted">Tech admin · platform access</p>
        <Link href="/profile" className="btn btn-ghost mt-4">
          Profile
        </Link>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-2xl">Competitions</h2>
        <p className="text-sm text-muted">
          Every listing, claimed or not. Open a row for judging controls and
          live scores.
        </p>
        {comps.length === 0 ? (
          <p className="text-muted">No competitions yet. Add the first one below.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="border-b border-line bg-blush text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Competition</th>
                  <th className="px-4 py-3 font-medium">Claim</th>
                  <th className="px-4 py-3 font-medium">Apps</th>
                  <th className="px-4 py-3 font-medium">Judging</th>
                  <th className="px-4 py-3 font-medium">Teams</th>
                  <th className="px-4 py-3 font-medium">Packets</th>
                  <th className="px-4 py-3 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {comps.map((comp) => {
                  const claimed = Boolean(comp.claimedAt);
                  const appsOpen = isCompetitionOpen(comp);
                  const packetsIn = comp.judgeAssignments.filter(
                    (row) => row.submittedAt,
                  ).length;
                  return (
                    <tr
                      key={comp.id}
                      className="border-b border-line last:border-0"
                    >
                      <th className="px-4 py-3 text-left font-semibold">
                        {comp.name}
                      </th>
                      <td className="px-4 py-3">
                        {claimed ? "Claimed" : "Unclaimed"}
                      </td>
                      <td className="px-4 py-3">
                        {!claimed
                          ? "—"
                          : appsOpen
                            ? "Open"
                            : "Closed"}
                      </td>
                      <td className="px-4 py-3">
                        {!claimed
                          ? "—"
                          : comp.judgingOpen
                            ? "Open"
                            : "Closed"}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {comp.applications.length}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {packetsIn} / {comp.requiredJudgeCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            href={`/ops/comps/${comp.id}`}
                            prefetch
                            className={
                              claimed && comp.judgingOpen
                                ? "btn btn-primary py-1.5"
                                : "btn btn-ghost py-1.5"
                            }
                          >
                            {claimed && comp.judgingOpen ? "Live" : "Open"}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-line bg-card p-6">
        <h2 className="font-heading text-xl">Tech admins</h2>
        <p className="text-sm text-muted">
          Everyone here has the same circuit-ops access. Invite by email.
        </p>
        <InvitePlatformAdminForm />
        <ul className="divide-y divide-line rounded-lg border border-line">
          {techAdmins.map((admin) => (
            <li
              key={admin.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
            >
              <span className="text-sm">
                {admin.name ? `${admin.name} · ` : ""}
                {admin.email}
                {admin.id === userId ? " · You" : ""}
              </span>
              {admin.id !== userId ? (
                <RevokePlatformAdminForm userId={admin.id} />
              ) : null}
            </li>
          ))}
          {techInvites.map((invite) => (
            <li
              key={invite.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
            >
              <span className="text-sm">
                {invite.email}
                <span className="text-muted"> · waiting to log in</span>
              </span>
              <CancelPlatformAdminInviteForm inviteId={invite.id} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 rounded-xl border border-line bg-card p-6">
        <h2 className="font-heading text-xl">Registration (REG) access</h2>
        <p className="text-sm text-muted">
          REG accounts are the only ones that can play the AVs. They run live
          viewing for one competition, share their screen with the judges
          elsewhere, and choose which team every judge scores.
        </p>
        <GrantRegistrationForm
          competitions={comps.map((comp) => ({ id: comp.id, name: comp.name }))}
        />
        {regAccess.length === 0 && regInvites.length === 0 ? (
          <p className="text-sm text-muted">No REG accounts yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {regAccess.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <span className="text-sm">
                  <span className="font-medium">{row.competition.name}</span>
                  <span className="text-muted"> · </span>
                  {row.user.email}
                </span>
                <RemoveRegistrationAccessForm accessId={row.id} />
              </li>
            ))}
            {regInvites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <span className="text-sm">
                  <span className="font-medium">{invite.competition.name}</span>
                  <span className="text-muted"> · </span>
                  {invite.email}
                  <span className="text-muted"> · waiting to log in</span>
                </span>
                <CancelRegistrationInviteForm inviteId={invite.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <CreateTeamForm />
        <CreateCompForm />
      </div>

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
                    {team.applyBlocked ? (
                      <p className="mt-1 max-w-xl text-sm text-muted">
                        Circuit ops reason: {team.applyBlockReason || "No reason recorded for this earlier block."}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SetTeamApplyBlockForm
                      teamId={team.id}
                      teamName={team.name}
                      blocked={team.applyBlocked}
                      reason={team.applyBlockReason}
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
        <h2 className="font-heading text-2xl">Competition listings</h2>
        {comps.length === 0 ? (
          <p className="text-muted">No competitions yet. Add the first one above.</p>
        ) : (
          <div className="space-y-6">
            {comps.map((comp) => {
            const pending = comp.applications.filter((a) => a.status === "PENDING").length;
            const accepted = comp.applications.filter((a) => a.status === "ACCEPTED").length;
            const waitlisted = comp.applications.filter((a) => a.status === "WAITLISTED").length;
            const declined = comp.applications.filter((a) => a.status === "DECLINED").length;
            return (
              <article
                id={`ops-comp-${comp.id}`}
                key={comp.id}
                className="space-y-4 rounded-xl border border-line bg-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-xl">{comp.name}</h3>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">
                      Claim code
                    </p>
                    <p className="font-mono text-sm text-accent">{comp.claimCode}</p>
                    <p className="text-sm text-muted">
                      {comp.claimedAt ? "Claimed" : "Unclaimed · not in team Apply"}
                      {comp.claimedAt
                        ? isCompetitionOpen(comp)
                          ? " · Apps open"
                          : comp.judgingOpen
                            ? " · Judging open"
                            : " · Judging closed"
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/ops/comps/${comp.id}`}
                      prefetch
                      className="btn btn-ghost py-1.5"
                    >
                      Comp Dashboard
                    </Link>
                    {comp.claimedAt ? (
                      <ResetCompClaimForm
                        competitionId={comp.id}
                        competitionName={comp.name}
                      />
                    ) : null}
                  </div>
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
        )}
      </section>
    </div>
  );
}
