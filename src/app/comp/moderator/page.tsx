import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompetitionId, isCompAdmin } from "@/lib/team-access";
import {
  AssignCompModeratorForm,
  CancelModeratorInviteForm,
  RemoveModeratorAccessForm,
} from "@/components/AccountForms";

export default async function CompModeratorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const competitionId = await getActiveCompetitionId(session.user.id);
  if (!competitionId) redirect("/dashboard");
  if (!(await isCompAdmin(session.user.id, competitionId))) redirect("/dashboard");

  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    select: {
      id: true,
      name: true,
      moderatorAccess: {
        include: { user: { select: { email: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      moderatorInvites: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!competition) redirect("/dashboard");

  const assigned = Boolean(competition.moderatorAccess.length || competition.moderatorInvites.length);
  return (
    <div className="space-y-8">
      <Link href="/dashboard" className="text-sm underline">← Back to dashboard</Link>
      <div>
        <h1 className="font-heading text-4xl">Moderator · {competition.name}</h1>
        <p className="mt-2 max-w-2xl text-muted">
          The moderator runs anonymous live AV viewing: they play each video and
          choose which team judges score next. Moderator access does not grant
          competition admin rights or the ability to submit judge scores.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border border-line bg-card p-5">
        <h2 className="font-heading text-2xl">Assigned moderator</h2>
        {assigned ? (
          <ul className="divide-y divide-line rounded-lg border border-line text-sm">
            {competition.moderatorAccess.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                <span>{row.user.name ? `${row.user.name} · ` : ""}{row.user.email}</span>
                <RemoveModeratorAccessForm accessId={row.id} />
              </li>
            ))}
            {competition.moderatorInvites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                <span>{invite.email}<span className="text-muted"> · waiting to log in</span></span>
                <CancelModeratorInviteForm inviteId={invite.id} />
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No moderator assigned yet.</p>}
        <AssignCompModeratorForm competitionId={competition.id} replacing={assigned} />
      </section>
    </div>
  );
}
