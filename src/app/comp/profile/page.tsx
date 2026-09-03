import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { CompProfileForm } from "@/components/CompProfileForm";
import { toDatetimeLocalValue } from "@/lib/judging";

export default async function CompProfilePage() {
  const session = await auth();
  const competition = await prisma.competitionProfile.findUnique({
    where: { userId: session!.user.id },
  });
  if (!competition) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl">Competition Details</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Dates, venue, stage size, lighting, and production notes show on the
          public listing. Set your own application deadline. Toggle “accepting
          applications” when you are ready.
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
          googleSheetUrl: competition.googleSheetUrl,
          acceptingApps: competition.acceptingApps,
          applicationDeadline: toDatetimeLocalValue(
            competition.applicationDeadline,
          ),
          requiredJudgeCount: competition.requiredJudgeCount,
        }}
      />
    </div>
  );
}
