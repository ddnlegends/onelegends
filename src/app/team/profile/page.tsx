import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { TeamProfileForm } from "@/components/TeamProfileForm";
import { DancerRoster } from "@/components/DancerRoster";

export default async function TeamProfilePage() {
  const session = await auth();
  const team = await prisma.teamProfile.findUnique({
    where: { userId: session!.user.id },
    include: { dancers: { orderBy: { name: "asc" } } },
  });
  if (!team) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-4xl">Team Profile</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Required before you can apply: photo, blurb, wiki, AV Drive file,
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
