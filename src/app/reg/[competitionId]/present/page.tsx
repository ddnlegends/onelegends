import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PresentationScreen } from "@/components/PresentationScreen";
import { ensureSharedViewingOrder, isJudgingOpen } from "@/lib/judging";
import { hasRegistrationAccess } from "@/lib/registration";

export default async function RegPresentationPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(await hasRegistrationAccess(session.user.id, competitionId))) notFound();

  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
  });
  if (!competition) notFound();

  const open = isJudgingOpen(competition);
  if (open) await ensureSharedViewingOrder(competitionId);
  const applications = await prisma.application.findMany({
    where: { competitionId, viewingPosition: { not: null } },
    select: {
      viewingPosition: true,
      team: { select: { avDriveUrl: true } },
    },
  });

  return (
    <PresentationScreen
      competitionId={competitionId}
      teams={applications.map((app) => ({
        position: app.viewingPosition as number,
        avDriveUrl: app.team.avDriveUrl,
      }))}
      initial={{ judgingOpen: open, livePosition: open ? competition.livePosition : null }}
    />
  );
}
