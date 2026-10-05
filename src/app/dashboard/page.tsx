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
import { getRegistrationCompetitions } from "@/lib/registration";
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
  InvitePlatformAdminForm,
  CancelPlatformAdminInviteForm,
  RevokePlatformAdminForm,
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

  const [
    pending,
    teamMemberships,
    compMemberships,
    judging,
    registrationCompetitions,
  ] = await Promise.all([
    getPendingInvites(userId, email),
    getApprovedTeamMemberships(userId),
    getApprovedCompMemberships(userId),
    userHasJudgeAccess(userId),
    getRegistrationCompetitions(userId),
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
                registrationCompetitions.length ? "REG" : null,
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
          {!team && !competition && !judging && !registrationCompetitions.length ? (
            <Link href="/claim" className="btn btn-primary">
              Code Claim
            </Link>
          ) : (
            <Link href="/claim" className="btn btn-ghost">
              Code Claim
            </Link>
          )}
        </div>
        {!team && !competition && !judging && !registrationCompetitions.length ? (
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

      {registrationCompetitions.length ? (
        <section className="space-y-4">
          <div>
            <h2 className="font-heading text-2xl">Live Viewing</h2>
            <p className="mt-1 text-sm text-muted">
              Select a competition to run its live viewing session.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {registrationCompetitions.map((competition) => (
              <Link
                key={competition.id}
                href={`/reg/${competition.id}`}
                prefetch
                className="brand-gradient group flex min-h-44 flex-col justify-between rounded-2xl p-6 text-white shadow-sm transition hover:brightness-110"
              >
                <span
                  className="grid size-12 place-items-center rounded-xl border border-white/35 bg-white/10"
                  aria-hidden
                >
                  <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-current" strokeWidth="1.8">
                    <rect x="3" y="5" width="13" height="14" rx="2" />
                    <path d="m16 10 5-3v10l-5-3" />
                    <path d="m9 10 4 2-4 2Z" className="fill-current stroke-none" />
                  </svg>
                </span>
                <span>
                  <span className="block text-xs uppercase tracking-widest text-white/80">
                    REG access
                  </span>
                  <span className="mt-1 block font-heading text-2xl tracking-wide">
                    {competition.name}
                  </span>
                  <span className="mt-4 inline-flex rounded-full border border-white/40 px-4 py-2 text-sm font-semibold transition group-hover:bg-white group-hover:text-accent">
                    Open Live Viewing
                  </span>
                </span>
              </Link>
            ))}
          </div>
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
  const [competitions, techAdmins, techInvites, regAccess, regInvites] =
    await Promise.all([
      prisma.competitionProfile.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { platformAdmin: true },
        select: { id: true, email: true, name: true },
        orderBy: { email: "asc" },
      }),
      prisma.platformAdminInvite.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.registrationAccess.findMany({
        include: { user: { select: { email: true } }, competition: { select: { name: true } } },
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
          Manage the circuit, live judging, access, teams, and competitions.
        </p>
      </div>

      <Link href="/ops/comps" prefetch className="brand-gradient group flex flex-wrap items-center justify-between gap-4 rounded-2xl px-6 py-5 text-white shadow-sm transition hover:brightness-110">
        <div><p className="text-xs uppercase tracking-widest text-white/80">Live judging</p><p className="font-heading text-2xl tracking-wide">Comp Dashboard</p><p className="mt-1 text-sm text-white/85">Follow every live viewing session and judge score.</p></div>
        <span className="rounded-full border border-white/40 px-4 py-2 text-sm font-semibold transition group-hover:bg-white group-hover:text-accent">Open</span>
      </Link>

      <section className="rounded-xl border border-line bg-card p-6">
        <h2 className="font-heading text-xl">Your account</h2><p className="mt-2">{name || email}</p>
        {name ? <p className="text-sm text-muted">{email}</p> : null}
        <p className="text-sm text-muted">Tech admin · platform access</p>
        <Link href="/profile" className="btn btn-ghost mt-4">Profile</Link>
      </section>

      <div className="grid gap-6 lg:grid-cols-2"><CreateTeamForm /><CreateCompForm /></div>

      <section className="space-y-4 rounded-xl border border-line bg-card p-6">
        <h2 className="font-heading text-xl">Registration (REG) access</h2>
        <p className="text-sm text-muted">Grant an account control of live viewing for a competition.</p>
        <GrantRegistrationForm competitions={competitions} />
        {regAccess.length === 0 && regInvites.length === 0 ? <p className="text-sm text-muted">No REG accounts yet.</p> : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {regAccess.map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"><span className="text-sm"><span className="font-medium">{row.competition.name}</span><span className="text-muted"> · </span>{row.user.email}</span><RemoveRegistrationAccessForm accessId={row.id} /></li>)}
            {regInvites.map((invite) => <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"><span className="text-sm"><span className="font-medium">{invite.competition.name}</span><span className="text-muted"> · </span>{invite.email}<span className="text-muted"> · waiting to log in</span></span><CancelRegistrationInviteForm inviteId={invite.id} /></li>)}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Link href="/ops/teams" prefetch className="group rounded-2xl border border-line bg-card p-6 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"><p className="text-xs uppercase tracking-widest text-muted">Circuit management</p><h2 className="mt-1 font-heading text-2xl group-hover:text-accent">Teams</h2><p className="mt-2 text-sm text-muted">Claim codes, owners, profiles, rosters, applications, and application blocks.</p><span className="mt-5 inline-flex text-sm font-semibold text-accent">Manage teams →</span></Link>
        <Link href="/ops/competitions" prefetch className="group rounded-2xl border border-line bg-card p-6 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"><p className="text-xs uppercase tracking-widest text-muted">Circuit management</p><h2 className="mt-1 font-heading text-2xl group-hover:text-accent">Competitions</h2><p className="mt-2 text-sm text-muted">Claim codes, owners, event details, REG access, applications, and live-dashboard links.</p><span className="mt-5 inline-flex text-sm font-semibold text-accent">Manage competitions →</span></Link>
        <Link href="/ops/export" prefetch className="group rounded-2xl border border-line bg-card p-6 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"><p className="text-xs uppercase tracking-widest text-muted">Reports</p><h2 className="mt-1 font-heading text-2xl group-hover:text-accent">Export data</h2><p className="mt-2 text-sm text-muted">Download judging scores, results, lineups, rosters, details, and access lists as .xlsx or CSV.</p><span className="mt-5 inline-flex text-sm font-semibold text-accent">Open exports →</span></Link>
      </div>

      <section className="space-y-4 rounded-xl border border-line bg-card p-6">
        <h2 className="font-heading text-xl">Tech admins</h2><p className="text-sm text-muted">Everyone here has the same circuit-ops access. Invite by email.</p>
        <InvitePlatformAdminForm />
        <ul className="divide-y divide-line rounded-lg border border-line">
          {techAdmins.map((admin) => <li key={admin.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"><span className="text-sm">{admin.name ? `${admin.name} · ` : ""}{admin.email}{admin.id === userId ? " · You" : ""}</span>{admin.id !== userId ? <RevokePlatformAdminForm userId={admin.id} /> : null}</li>)}
          {techInvites.map((invite) => <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"><span className="text-sm">{invite.email}<span className="text-muted"> · waiting to log in</span></span><CancelPlatformAdminInviteForm inviteId={invite.id} /></li>)}
        </ul>
      </section>
    </div>
  );
}
