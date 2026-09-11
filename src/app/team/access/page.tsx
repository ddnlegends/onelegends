import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getActiveTeamId, isTeamPrimary } from "@/lib/team-access";
import {
  CancelTeamInviteForm,
  InviteTeamAdminForm,
  RevokeTeamAccessForm,
} from "@/components/AccountForms";

export default async function TeamAccessPage() {
  const session = await auth();
  const userId = session!.user.id;
  const teamId = await getActiveTeamId(userId);
  if (!teamId) redirect("/dashboard");

  const primary = await isTeamPrimary(userId, teamId);
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
          The primary admin claimed this team with the code. Only they can
          invite secondary admins by email. Secondaries approve the invite the
          next time they log in — the app does not send email.
        </p>
      </div>

      {primary ? <InviteTeamAdminForm teamId={team.id} /> : (
        <p className="text-sm text-muted">
          Only the primary admin can invite more admins.
        </p>
      )}

      {primary && (team.invites.length || waiting.length) ? (
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
                <RevokeTeamAccessForm membershipId={row.id} />
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
                <RevokeTeamAccessForm membershipId={row.id} />
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
