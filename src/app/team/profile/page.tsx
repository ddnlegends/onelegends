import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TeamProfileForm } from "@/components/TeamProfileForm";
import { DancerRoster } from "@/components/DancerRoster";
import { getActiveTeamId } from "@/lib/team-access";

export default async function TeamProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const teamId = await getActiveTeamId(session.user.id);
  if (!teamId) redirect("/dashboard");

  const team = await prisma.teamProfile.findUnique({
    where: { id: teamId },
    include: { dancers: { orderBy: { name: "asc" } } },
  });
  if (!team) redirect("/team");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-4xl">Team Profile</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Required before you can apply: team photo, blurb, AV Drive file,
          captains, years, roster count, and at least one dancer with a t-shirt
          size. Every selected competition receives this same packet.
        </p>
      </div>
      <TeamProfileForm profile={team} />
      <div>
        <h2 className="mb-3 font-heading text-2xl">Dancers</h2>
        <DancerRoster
          initial={team.dancers.map((d) => ({
            name: d.name,
            dietaryRestrictions: d.dietaryRestrictions,
            tshirtSize: d.tshirtSize,
            inAV: d.inAV,
          }))}
        />
      </div>
    </div>
  );
}
