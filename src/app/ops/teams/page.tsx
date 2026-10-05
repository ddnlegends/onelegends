import { auth } from "@/auth";
import {
  CancelTeamInviteForm,
  InviteTeamAdminForm,
  ResetTeamClaimForm,
  RevokeTeamAccessForm,
  SetTeamApplyBlockForm,
} from "@/components/AccountForms";
import { TeamDetails } from "@/components/TeamDetails";
import { prisma } from "@/lib/prisma";
import { statusLabel } from "@/lib/utils";

export default async function OpsTeamsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const teams = await prisma.teamProfile.findMany({
    orderBy: { name: "asc" },
    include: {
      dancers: { orderBy: { name: "asc" } },
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-4xl">Teams</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Manage every team listing, its claim code, administrators, profile,
          roster, applications, and application block here.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-card px-5 py-4 text-sm">
        {teams.length} teams · {teams.filter((team) => team.claimedAt).length} claimed ·{" "}
        {teams.filter((team) => team.applyBlocked).length} blocked from applying
      </div>

      {teams.length === 0 ? (
        <p className="text-muted">No teams yet. Create one from Circuit ops.</p>
      ) : (
        <div className="space-y-8">
          {teams.map((team) => {
            const approved = team.memberships.filter(
              (membership) => membership.status === "APPROVED",
            );
            const pending = team.memberships.filter(
              (membership) => membership.status === "PENDING",
            );

            return (
              <article
                id={`ops-team-${team.id}`}
                key={team.id}
                className="space-y-6 rounded-2xl border border-line bg-card p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-heading text-2xl">{team.name}</h2>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      Claim code
                    </p>
                    <p className="font-mono text-sm text-accent">{team.claimCode}</p>
                    <p className="mt-1 text-sm text-muted">
                      {team.claimedAt ? "Claimed" : "Unclaimed"}
                      {team.applyBlocked ? " · Blocked from applying" : ""}
                    </p>
                    {team.applyBlocked ? (
                      <p className="mt-1 max-w-xl text-sm text-muted">
                        Circuit ops reason: {team.applyBlockReason || "No reason recorded."}
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

                {team.claimedAt ? <InviteTeamAdminForm teamId={team.id} /> : null}

                {team.invites.length || pending.length ? (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold">Requests sent</h3>
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
                  </section>
                ) : null}

                <section>
                  <h3 className="mb-2 text-sm font-semibold">Owners and admins</h3>
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
                            {membership.user.email}
                            {membership.isPrimary ? " · Primary" : " · Secondary"}
                          </span>
                          {!membership.isPrimary && membership.userId !== userId ? (
                            <RevokeTeamAccessForm membershipId={membership.id} />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <TeamDetails team={team} />

                <section>
                  <h3 className="mb-2 font-heading text-xl">Competition applications</h3>
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
                          <span>{statusLabel(application.status)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
