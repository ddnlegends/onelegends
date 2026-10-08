import Link from "next/link";
import { requirePlatformAdminPage } from "@/lib/page-guards";
import {
  CancelTeamInviteForm,
  InviteTeamAdminForm,
  ResetTeamClaimForm,
  RevokeTeamAccessForm,
  SetTeamApplyBlockForm,
} from "@/components/AccountForms";
import { ExpandableRow } from "@/components/ExpandableRow";
import { Chip, InfoGrid, PanelSection } from "@/components/OpsListParts";
import { TeamDetails } from "@/components/TeamDetails";
import { TeamPhoto } from "@/components/TeamPhoto";
import { prisma } from "@/lib/prisma";
import { formatDate, statusLabel } from "@/lib/utils";

export default async function OpsTeamsPage() {
  await requirePlatformAdminPage();
  const teams = await prisma.teamProfile.findMany({
    orderBy: { name: "asc" },
    include: {
      dancers: { orderBy: { name: "asc" } },
      memberships: {
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      invites: { orderBy: { createdAt: "desc" } },
      applications: {
        include: { competition: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  const claimed = teams.filter((team) => team.claimedAt).length;
  const blocked = teams.filter((team) => team.applyBlocked).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-4xl">Teams</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Every team listing. Open a team with its arrow to see and manage its
          claim code, admins, full profile, roster, video, and applications.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Teams", value: teams.length },
          { label: "Claimed", value: claimed },
          { label: "Blocked from applying", value: blocked },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-line bg-card px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-muted">{stat.label}</p>
            <p className="font-heading text-3xl tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>

      {teams.length === 0 ? (
        <p className="text-muted">No teams yet. Create one from Circuit ops.</p>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => {
            const approved = team.memberships.filter((m) => m.status === "APPROVED");
            const pending = team.memberships.filter((m) => m.status === "PENDING");
            const primary = approved.find((m) => m.isPrimary);

            return (
              <ExpandableRow
                key={team.id}
                id={`ops-team-${team.id}`}
                summary={
                  <div className="flex items-center gap-4">
                    <TeamPhoto src={team.photoUrl} name={team.name} size="sm" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-heading text-xl">{team.name}</span>
                        {team.claimedAt ? (
                          <Chip tone="good">Claimed</Chip>
                        ) : (
                          <Chip>Unclaimed</Chip>
                        )}
                        {team.applyBlocked ? <Chip tone="bad">Blocked</Chip> : null}
                        {pending.length || team.invites.length ? (
                          <Chip tone="warn">
                            {pending.length + team.invites.length} pending
                          </Chip>
                        ) : null}
                      </div>
                      <p className="truncate text-sm text-muted">
                        {team.rosterSize ?? team.dancers.length} dancers ·{" "}
                        {team.applications.length} application
                        {team.applications.length === 1 ? "" : "s"}
                        {primary ? ` · ${primary.user.email}` : ""}
                      </p>
                    </div>
                  </div>
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Claim code
                    </p>
                    <p className="font-mono text-lg text-accent">{team.claimCode}</p>
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    <Link
                      href={`/ops/teams/${team.id}`}
                      prefetch={false}
                      className="btn btn-ghost py-1.5"
                    >
                      Full page
                    </Link>
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

                <InfoGrid
                  items={[
                    { label: "Status", value: team.claimedAt ? `Claimed ${formatDate(team.claimedAt)}` : "Unclaimed" },
                    { label: "Listing created", value: formatDate(team.createdAt) },
                    { label: "Last updated", value: formatDate(team.updatedAt) },
                    { label: "Public page", value: <Link href={`/teams/${team.id}`} prefetch={false} className="text-accent underline">View public profile</Link> },
                    {
                      label: "Applications",
                      value: team.applyBlocked
                        ? `Blocked — ${team.applyBlockReason || "no reason recorded"}`
                        : "Allowed",
                    },
                  ]}
                />

                <PanelSection title="Owners and admins">
                  {approved.length === 0 ? (
                    <p className="text-sm text-muted">No owner has claimed this team yet.</p>
                  ) : (
                    <ul className="divide-y divide-line rounded-lg border border-line">
                      {approved.map((membership) => (
                        <li
                          key={membership.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                        >
                          <span className="text-sm">
                            {membership.user.name ? `${membership.user.name} · ` : ""}
                            {membership.user.email}
                            <span className="text-muted">
                              {membership.isPrimary ? " · Primary" : " · Secondary"}
                            </span>
                          </span>
                          <RevokeTeamAccessForm
                            membershipId={membership.id}
                            isPrimary={membership.isPrimary}
                            adminLabel={membership.user.email}
                            replacements={approved
                              .filter((candidate) => candidate.id !== membership.id && candidate.isAdmin)
                              .map((candidate) => ({ membershipId: candidate.id, label: candidate.user.email }))}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                  {team.claimedAt ? <InviteTeamAdminForm teamId={team.id} /> : null}
                </PanelSection>

                {team.invites.length || pending.length ? (
                  <PanelSection title="Requests sent">
                    <ul className="divide-y divide-line rounded-lg border border-line">
                      {team.invites.map((invite) => (
                        <li
                          key={invite.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                        >
                          <span className="text-sm">
                            {invite.email}
                            <span className="text-muted"> · waiting to create an account</span>
                          </span>
                          <CancelTeamInviteForm inviteId={invite.id} />
                        </li>
                      ))}
                      {pending.map((membership) => (
                        <li
                          key={membership.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                        >
                          <span className="text-sm">
                            {membership.user.email}
                            <span className="text-muted"> · waiting to approve</span>
                          </span>
                          <RevokeTeamAccessForm membershipId={membership.id} />
                        </li>
                      ))}
                    </ul>
                  </PanelSection>
                ) : null}

                <TeamDetails team={team} hideHeading />

                <PanelSection title="Competition applications">
                  {team.applications.length === 0 ? (
                    <p className="text-sm text-muted">No applications yet.</p>
                  ) : (
                    <ul className="divide-y divide-line rounded-lg border border-line text-sm">
                      {team.applications.map((application) => (
                        <li
                          key={application.id}
                          className="flex flex-wrap justify-between gap-3 px-3 py-2"
                        >
                          <span>{application.competition.name}</span>
                          <span className="text-muted">
                            {statusLabel(application.status)} · applied{" "}
                            {formatDate(application.createdAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </PanelSection>
              </ExpandableRow>
            );
          })}
        </div>
      )}
    </div>
  );
}
