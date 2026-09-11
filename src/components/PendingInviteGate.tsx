import { auth } from "@/auth";
import { getPendingInvites } from "@/lib/invites";
import { InviteModal } from "@/components/InviteModal";

export async function PendingInviteGate() {
  const session = await auth();
  if (!session?.user?.email) return null;

  const pending = await getPendingInvites(session.user.id, session.user.email);
  if (
    pending.teams.length + pending.comps.length + pending.judges.length ===
    0
  ) {
    return null;
  }

  return (
    <InviteModal
      teams={pending.teams.map((row) => ({
        id: row.id,
        teamName: row.team.name,
      }))}
      comps={pending.comps.map((row) => ({
        id: row.id,
        competitionName: row.competition.name,
      }))}
      judges={pending.judges.map((row) => ({
        id: row.id,
        competitionName: row.competition.name,
      }))}
    />
  );
}
