import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  getActiveCompetitionId,
  isCompAdmin,
  isCompPrimary,
} from "@/lib/team-access";
import {
  AssignCompModeratorForm,
  CancelModeratorInviteForm,
  CancelCompInviteForm,
  InviteCompAdminForm,
  RemoveModeratorAccessForm,
  RevokeCompAccessForm,
  TransferCompPrimaryForm,
} from "@/components/AccountForms";

export default async function CompAccessPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const competitionId = await getActiveCompetitionId(userId);
  if (!competitionId) redirect("/dashboard");

  const primary = await isCompPrimary(userId, competitionId);
  const admin = await isCompAdmin(userId, competitionId);
  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    include: {
      memberships: {
        include: { user: { select: { email: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      invites: { orderBy: { createdAt: "desc" } },
      moderatorAccess: {
        include: { user: { select: { email: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      moderatorInvites: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!competition) redirect("/dashboard");

  const waiting = competition.memberships.filter((m) => m.status === "PENDING");
  const approved = competition.memberships.filter((m) => m.status === "APPROVED");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-4xl">Admins · {competition.name}</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Approved admins can add secondary admins by email. The primary admin
          can transfer ownership or remove other admins. No email is sent from
          this app.
        </p>
      </div>

      {admin ? (
        <InviteCompAdminForm competitionId={competition.id} />
      ) : (
        <p className="text-sm text-muted">
          Only an approved admin can invite more admins.
        </p>
      )}

      {admin && (competition.invites.length || waiting.length) ? (
        <section>
          <h2 className="mb-3 font-heading text-2xl">Request sent</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card text-sm">
            {competition.invites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span>
                  {invite.email}
                  <span className="text-muted">
                    {" "}
                    — waiting to create an account
                  </span>
                </span>
                <CancelCompInviteForm inviteId={invite.id} />
              </li>
            ))}
            {waiting.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span>
                  {row.user.email}
                  <span className="text-muted"> — waiting to approve</span>
                </span>
                {primary ? <RevokeCompAccessForm membershipId={row.id} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 font-heading text-2xl">Current admins</h2>
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {approved.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="font-medium">{row.user.email}</p>
                <p className="text-sm text-muted">
                  {row.isPrimary ? "Primary admin" : "Secondary admin"}
                  {row.userId === userId ? " · You" : ""}
                </p>
              </div>
              {primary && !row.isPrimary && row.userId !== userId ? (
                <div className="flex flex-wrap gap-2">
                  <TransferCompPrimaryForm membershipId={row.id} adminLabel={row.user.email} />
                  <RevokeCompAccessForm membershipId={row.id} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 rounded-xl border border-line bg-card p-5">
        <div>
          <h2 className="font-heading text-2xl">Moderator</h2>
          <p className="mt-1 text-sm text-muted">
            The moderator runs anonymous live AV viewing: they play each video and
            choose which team judges score next. Moderator access does not grant
            competition admin rights or the ability to submit judge scores.
          </p>
        </div>
        {competition.moderatorAccess.length || competition.moderatorInvites.length ? (
          <ul className="divide-y divide-line rounded-lg border border-line text-sm">
            {competition.moderatorAccess.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                <span>{row.user.name ? `${row.user.name} · ` : ""}{row.user.email}</span>
                {admin ? <RemoveModeratorAccessForm accessId={row.id} /> : null}
              </li>
            ))}
            {competition.moderatorInvites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                <span>{invite.email}<span className="text-muted"> · waiting to log in</span></span>
                {admin ? <CancelModeratorInviteForm inviteId={invite.id} /> : null}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No moderator assigned yet.</p>}
        {admin ? (
          <AssignCompModeratorForm
            competitionId={competition.id}
            replacing={Boolean(competition.moderatorAccess.length || competition.moderatorInvites.length)}
          />
        ) : null}
      </section>
    </div>
  );
}
