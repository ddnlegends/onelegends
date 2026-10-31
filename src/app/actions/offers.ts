"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import { getActiveTeamId } from "@/lib/team-access";
import { PARTNER_CONFIRMATION_LIMIT } from "@/lib/application-offers";

type ActionState = { error?: string; ok?: boolean; message?: string };

function refreshOfferViews() {
  revalidatePath("/team");
  revalidatePath("/team/decisions");
  revalidatePath("/dashboard");
  revalidatePath("/comp");
  revalidatePath("/comp/applicants");
  revalidatePath("/ops/competitions");
}

export async function respondToCompetitionOffer(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!user) return { error: "Sign in to respond to an offer." };
  const teamId = await getActiveTeamId(user.id);
  if (!teamId) return { error: "Select a team first." };
  const applicationId = String(formData.get("applicationId") ?? "");
  const intent = String(formData.get("intent") ?? "");
  if (!applicationId || (intent !== "confirm" && intent !== "decline")) return { error: "Choose a valid response." };
  if (formData.get("acknowledge") !== "on") return { error: "Confirm your choice before continuing." };

  const result = await prisma.$transaction(async (tx) => {
    // All team confirmations serialize on this row, even across competition tabs or admins.
    await tx.$queryRaw`SELECT id FROM "TeamProfile" WHERE id = ${teamId} FOR UPDATE`;
    const application = await tx.application.findFirst({
      where: { id: applicationId, teamId, removedAt: null },
      select: {
        id: true, status: true, teamOfferResponse: true,
        competition: { select: { name: true, isPartner: true, isAffiliate: true, decisionsSubmittedAt: true } },
      },
    });
    if (!application?.competition.decisionsSubmittedAt) return { error: "This decision has not been announced." };
    if (application.teamOfferResponse !== "NONE") return { error: "This offer is no longer awaiting a response. Refresh the page." };
    if (intent === "confirm" && application.status !== "ACCEPTED") return { error: "Only an offered spot can be confirmed." };
    if (intent === "decline" && application.status !== "ACCEPTED" && application.status !== "WAITLISTED") {
      return { error: "This application has no offer or waitlist position to decline." };
    }

    const partner = application.competition.isPartner && !application.competition.isAffiliate;
    let confirmed = 0;
    if (partner && intent === "confirm") {
      confirmed = await tx.application.count({
        where: {
          teamId, removedAt: null, teamOfferResponse: "CONFIRMED",
          competition: { isPartner: true, isAffiliate: false, decisionsSubmittedAt: { not: null } },
        },
      });
      if (confirmed >= PARTNER_CONFIRMATION_LIMIT) return { error: "Your team has already confirmed three Partner competitions." };
    }

    const now = new Date();
    const response = intent === "confirm" ? "CONFIRMED" : "DECLINED";
    await tx.application.update({
      where: { id: application.id },
      data: { teamOfferResponse: response, teamOfferRespondedAt: now },
    });
    await tx.applicationOfferEvent.create({
      data: { applicationId: application.id, actorUserId: user.id, type: intent === "confirm" ? "OFFER_CONFIRMED" : "OFFER_DECLINED" },
    });

    let closed = 0;
    if (partner && intent === "confirm" && confirmed + 1 === PARTNER_CONFIRMATION_LIMIT) {
      const others = await tx.application.findMany({
        where: {
          teamId, id: { not: application.id }, removedAt: null,
          status: { in: ["ACCEPTED", "WAITLISTED"] }, teamOfferResponse: "NONE",
          competition: { isPartner: true, isAffiliate: false, decisionsSubmittedAt: { not: null } },
        },
        select: { id: true },
      });
      if (others.length) {
        await tx.application.updateMany({
          where: { id: { in: others.map((row) => row.id) } },
          data: { teamOfferResponse: "CAP_CLOSED", teamOfferRespondedAt: now },
        });
        await tx.applicationOfferEvent.createMany({
          data: others.map((row) => ({ applicationId: row.id, actorUserId: null, type: "CAP_CLOSED" as const })),
        });
        closed = others.length;
      }
    }
    return { ok: true, message: intent === "confirm"
      ? `Spot confirmed at ${application.competition.name}.${closed ? ` ${closed} other Partner offer or waitlist position closed.` : ""}`
      : application.status === "WAITLISTED"
        ? `You left the waitlist for ${application.competition.name}.`
        : `Offer declined for ${application.competition.name}.` };
  });
  if (result.ok) refreshOfferViews();
  return result;
}
