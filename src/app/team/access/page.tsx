import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getActiveTeamId, isTeamAdmin, isTeamPrimary } from "@/lib/team-access";
import {
  CancelTeamInviteForm,
  InviteTeamAdminForm,
  RevokeTeamAccessForm,
  TransferTeamPrimaryForm,
} from "@/components/AccountForms";

export default async function TeamAccessPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const teamId = await getActiveTeamId(userId);
  if (!teamId) redirect("/dashboard");

  const primary = await isTeamPrimary(userId, teamId);
  const admin = await isTeamAdmin(userId, teamId);
  const team = await prisma.teamProfile.findUnique({
    where: { id: teamId },
    include: {
      memberships: {
        include: { user: { select: { email: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      invites: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!team) redirect("/dashboard");

  const waiting = team.memberships.filter((m) => m.status === "PENDING");
  const approved = team.memberships.filter((m) => m.status === "APPROVED");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-4xl">Admins · {team.name}</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Approved admins can add secondary admins by email. The primary admin
          can transfer ownership or remove other admins. No email is sent from
          the app; invitees approve access the next time they log in.
        </p>
      </div>

      {admin ? <InviteTeamAdminForm teamId={team.id} /> : (
        <p className="text-sm text-muted">
          Only an approved admin can invite more admins.
        </p>
      )}

      {admin && (team.invites.length || waiting.length) ? (
        <section>
          <h2 className="mb-3 font-heading text-2xl">Request sent</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card text-sm">
            {team.invites.map((invite) => (
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
                <CancelTeamInviteForm inviteId={invite.id} />
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
                {primary ? <RevokeTeamAccessForm membershipId={row.id} /> : null}
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
                  <TransferTeamPrimaryForm membershipId={row.id} adminLabel={row.user.email} />
                  <RevokeTeamAccessForm membershipId={row.id} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
