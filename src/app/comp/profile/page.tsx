import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { CompProfileForm } from "@/components/CompProfileForm";
import { getActiveCompetitionId, isPlatformAdmin } from "@/lib/team-access";

export default async function CompProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (await isPlatformAdmin(session.user.id)) redirect("/dashboard");
  const competitionId = await getActiveCompetitionId(session.user.id);
  if (!competitionId) return null;
  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
  });
  if (!competition) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl">Competition Details</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Dates, venue, stage size, lighting, and production notes show on the
          public listing. Set early and late application deadlines. The late
          deadline closes applications. Toggle “accepting applications” when
          you are ready.
        </p>
      </div>
      <CompProfileForm
        profile={{
          name: competition.name,
          dates: competition.dates,
          location: competition.location,
          venue: competition.venue,
          stageSize: competition.stageSize,
          productionNotes: competition.productionNotes,
          lighting: competition.lighting,
          description: competition.description,
          acceptingApps: competition.acceptingApps,
          earlyApplicationDeadline: competition.earlyApplicationDeadline?.toISOString() ?? "",
          applicationDeadline: competition.applicationDeadline?.toISOString() ?? "",
        }}
      />
    </div>
  );
}
