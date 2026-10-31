import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveTeamId } from "@/lib/team-access";
import { TeamDecisionBoard, type TeamDecisionItem } from "@/components/TeamDecisionBoard";
import { offerStatusLabel, PARTNER_CONFIRMATION_LIMIT } from "@/lib/application-offers";

export default async function TeamDecisionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const teamId = await getActiveTeamId(session.user.id);
  if (!teamId) redirect("/dashboard");
  const team = await prisma.teamProfile.findUnique({
    where: { id: teamId },
    select: {
      name: true,
      applications: {
        where: { removedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, status: true, teamOfferResponse: true,
          competition: { select: { name: true, isPartner: true, isAffiliate: true, decisionsSubmittedAt: true } },
        },
      },
    },
  });
  if (!team) redirect("/dashboard");
  const partnerConfirmed = team.applications.filter((app) =>
    app.competition.isPartner && !app.competition.isAffiliate &&
    app.competition.decisionsSubmittedAt && app.teamOfferResponse === "CONFIRMED",
  ).length;
  const items: TeamDecisionItem[] = team.applications.map((app) => {
    const announced = Boolean(app.competition.decisionsSubmittedAt);
    const open = announced && app.teamOfferResponse === "NONE";
    const partner = app.competition.isPartner && !app.competition.isAffiliate;
    return {
      id: app.id,
      name: app.competition.name,
      category: app.competition.isAffiliate ? "Affiliate" : app.competition.isPartner ? "Partner" : "Non-partner",
      status: offerStatusLabel({ ...app, decisionsSubmittedAt: app.competition.decisionsSubmittedAt }),
      canConfirm: open && app.status === "ACCEPTED" && (!partner || partnerConfirmed < PARTNER_CONFIRMATION_LIMIT),
      canDecline: open && (app.status === "ACCEPTED" || app.status === "WAITLISTED"),
      confirmed: announced && app.teamOfferResponse === "CONFIRMED",
    };
  });
  return <div className="space-y-6">
    <div>
      <h1 className="font-heading text-4xl">Your competition decisions</h1>
      <p className="mt-2 text-muted">{team.name} · Review offers and choose where your team will compete. Decisions appear only after each host submits its final outcomes.</p>
    </div>
    <TeamDecisionBoard items={items} partnerConfirmed={partnerConfirmed} />
  </div>;
}
