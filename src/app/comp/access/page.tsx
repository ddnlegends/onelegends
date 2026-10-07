import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  getActiveCompetitionId,
  isCompPrimary,
} from "@/lib/team-access";
import {
  CancelCompInviteForm,
  InviteCompAdminForm,
  RevokeCompAccessForm,
} from "@/components/AccountForms";

export default async function CompAccessPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const competitionId = await getActiveCompetitionId(userId);
  if (!competitionId) redirect("/dashboard");

  const primary = await isCompPrimary(userId, competitionId);
  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    include: {
      memberships: {
        include: { user: { select: { email: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      invites: { orderBy: { createdAt: "desc" } },
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
          The primary admin claimed this listing with the claim code. Only they
          can invite secondary admins by email. No email is sent from this app.
        </p>
      </div>

      {primary ? (
        <InviteCompAdminForm competitionId={competition.id} />
      ) : (
        <p className="text-sm text-muted">
          Only the primary admin can invite more admins.
        </p>
      )}

      {primary && (competition.invites.length || waiting.length) ? (
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
                <RevokeCompAccessForm membershipId={row.id} />
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
                <RevokeCompAccessForm membershipId={row.id} />
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
