import Link from "next/link";
import { auth } from "@/auth";
import {
  CancelCompInviteForm,
  InviteCompAdminForm,
  ResetCompClaimForm,
  RevokeCompAccessForm,
} from "@/components/AccountForms";
import { prisma } from "@/lib/prisma";
import { isCompetitionOpen } from "@/lib/judging";
import { statusLabel } from "@/lib/utils";

export default async function OpsCompetitionsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const competitions = await prisma.competitionProfile.findMany({
    orderBy: { name: "asc" },
    include: {
      memberships: {
        include: { user: { select: { email: true } } },
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
      registrationAccess: { include: { user: { select: { email: true } } } },
      registrationInvites: true,
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-4xl">Competitions</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Manage every competition listing, claim code, administrators, access,
          application status, and event details here. Live judging stays on the
          Comp Dashboard.
        </p>
      </div>

      {competitions.length === 0 ? (
        <p className="text-muted">No competitions yet. Create one from Circuit ops.</p>
      ) : (
        <div className="space-y-8">
          {competitions.map((competition) => {
            const approved = competition.memberships.filter(
              (membership) => membership.status === "APPROVED",
            );
            const pending = competition.memberships.filter(
              (membership) => membership.status === "PENDING",
            );
            const packets = competition.judgeAssignments.filter(
              (assignment) => assignment.submittedAt,
            ).length;

            return (
              <article key={competition.id} className="space-y-6 rounded-2xl border border-line bg-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-heading text-2xl">{competition.name}</h2>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">Claim code</p>
                    <p className="font-mono text-sm text-accent">{competition.claimCode}</p>
                    <p className="mt-1 text-sm text-muted">
                      {competition.claimedAt
                        ? isCompetitionOpen(competition)
                          ? "Claimed · Applications open"
                          : competition.judgingOpen
                            ? "Claimed · Judging open"
                            : "Claimed · Judging closed"
                        : "Unclaimed"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/ops/comps/${competition.id}`} prefetch className="btn btn-ghost py-1.5">
                      Open Live Dashboard
                    </Link>
                    {competition.claimedAt ? (
                      <ResetCompClaimForm competitionId={competition.id} competitionName={competition.name} />
                    ) : null}
                  </div>
                </div>

                <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div><dt className="text-muted">Dates</dt><dd>{competition.dates || "—"}</dd></div>
                  <div><dt className="text-muted">Location</dt><dd>{competition.location || "—"}</dd></div>
                  <div><dt className="text-muted">Venue</dt><dd>{competition.venue || "—"}</dd></div>
                  <div><dt className="text-muted">Packets submitted</dt><dd>{packets} / {competition.requiredJudgeCount}</dd></div>
                </dl>
                {competition.description ? <p className="text-sm text-muted">{competition.description}</p> : null}

                {competition.claimedAt ? <InviteCompAdminForm competitionId={competition.id} /> : null}

                {competition.invites.length || pending.length ? (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold">Requests sent</h3>
                    <ul className="divide-y divide-line rounded-lg border border-line">
                      {competition.invites.map((invite) => (
                        <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <span className="text-sm">{invite.email}<span className="text-muted"> · waiting to create an account</span></span>
                          <CancelCompInviteForm inviteId={invite.id} />
                        </li>
                      ))}
                      {pending.map((membership) => (
                        <li key={membership.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <span className="text-sm">{membership.user.email}<span className="text-muted"> · waiting to approve</span></span>
                          <RevokeCompAccessForm membershipId={membership.id} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <section>
                  <h3 className="mb-2 text-sm font-semibold">Owners and admins</h3>
                  {approved.length === 0 ? <p className="text-sm text-muted">No owner has claimed this competition yet.</p> : (
                    <ul className="divide-y divide-line rounded-lg border border-line">
                      {approved.map((membership) => (
                        <li key={membership.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <span className="text-sm">{membership.user.email}{membership.isPrimary ? " · Primary" : " · Secondary"}</span>
                          {!membership.isPrimary && membership.userId !== userId ? <RevokeCompAccessForm membershipId={membership.id} /> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold">REG access</h3>
                  <p className="text-sm text-muted">
                    {competition.registrationAccess.length
                      ? competition.registrationAccess.map((row) => row.user.email).join(", ")
                      : competition.registrationInvites.length
                        ? `${competition.registrationInvites.length} invitation${competition.registrationInvites.length === 1 ? "" : "s"} waiting`
                        : "No REG account assigned."}
                  </p>
                </section>

                <section>
                  <h3 className="mb-2 font-heading text-xl">Applications</h3>
                  {competition.applications.length === 0 ? <p className="text-sm text-muted">No applications yet.</p> : (
                    <ul className="divide-y divide-line rounded-lg border border-line text-sm">
                      {competition.applications.map((application) => (
                        <li key={application.id} className="flex flex-wrap justify-between gap-3 px-3 py-2">
                          <span>{application.team.name}</span><span>{statusLabel(application.status)}</span>
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
