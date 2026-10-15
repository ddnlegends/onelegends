import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { CompProfileForm } from "@/components/CompProfileForm";
import { CompetitionPacketForm } from "@/components/CompetitionPacketForm";
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
    include: { applicationPacket: { select: { filename: true } } },
  });
  if (!competition) return null;
  const gaps = competitionProfileGaps(competition);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl">Competition Details</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Share event dates, your competition bio, venue, AV guidelines, fees, payment instructions, and an application packet. Complete the required details before this competition appears to teams, then turn on Accepting Applications when you are ready.
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
          eventStartDate: competition.eventStartDate?.toISOString().slice(0, 10) ?? "",
          eventEndDate: competition.eventEndDate?.toISOString().slice(0, 10) ?? "",
          location: competition.location,
          venue: competition.venue,
          venueAddress: competition.venueAddress,
          regularApplicationFee: competition.regularApplicationFeeCents === null ? "" : (competition.regularApplicationFeeCents / 100).toFixed(2),
          lateApplicationFee: competition.lateApplicationFeeCents === null ? "" : (competition.lateApplicationFeeCents / 100).toFixed(2),
          paymentInstructions: competition.paymentInstructions,
          stageSize: competition.stageSize,
          productionNotes: competition.productionNotes,
          lighting: competition.lighting,
          description: competition.description,
          acceptingApps: competition.acceptingApps,
          earlyApplicationDeadline: competition.earlyApplicationDeadline?.toISOString() ?? "",
          applicationDeadline: competition.applicationDeadline?.toISOString() ?? "",
        }}
      />
      <CompetitionPacketForm competitionId={competition.id} filename={competition.applicationPacket?.filename ?? null} />
    </div>
  );
}
