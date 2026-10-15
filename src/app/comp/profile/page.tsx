import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { CompProfileForm } from "@/components/CompProfileForm";
import { getActiveCompetitionId, isPlatformAdmin } from "@/lib/team-access";
import { competitionProfileGaps } from "@/lib/competition-profile";

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
  const gaps = competitionProfileGaps(competition);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl">Competition Details</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Complete every required text detail before this competition appears to teams. Write N/A or TBD when a detail does not apply or is not known yet. Deadline dates are optional; leave them blank for N/A or TBD. Turn on Accepting Applications when you are ready for teams to apply.
        </p>
      </div>
      {gaps.length ? (
        <div className="rounded-xl border border-warning-line bg-warning-soft p-5 text-sm">
          <p className="font-semibold">Locked: this competition is hidden from teams.</p>
          <p className="mt-2">Still needed: {gaps.join(", ")}.</p>
        </div>
      ) : (
        <p className="rounded-xl border border-success-line bg-success-soft p-4 text-sm">All required details are filled. Your listing is visible to teams.</p>
      )}
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
