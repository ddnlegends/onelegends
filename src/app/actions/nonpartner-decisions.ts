"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import { requireActiveCompetition } from "@/lib/team-access";
import { visibleApplicationWhere } from "@/lib/payment-eligibility";

type State = { error?: string; ok?: boolean; message?: string };

export async function saveNonPartnerDecision(_previous: State | undefined, formData: FormData): Promise<State> {
  const user = await requireUser();
  if (!user) return { error: "Sign in first." };
  const competition = await requireActiveCompetition(user.id);
  if (!competition || competition.isPartner || competition.isAffiliate) return { error: "Only Non-partner hosts can use rolling decisions." };

  const applicationId = String(formData.get("applicationId") ?? "");
  const status = String(formData.get("status") ?? "");
  const intent = String(formData.get("intent") ?? "");
  if (!applicationId || !["PENDING", "ACCEPTED", "DECLINED"].includes(status) || !["draft", "publish"].includes(intent)) {
    return { error: "Choose a valid decision." };
  }
  if (intent === "publish" && (status === "PENDING" || formData.get("acknowledge") !== "on")) {
    return { error: "Choose Accepted or Declined and confirm before publishing." };
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${competition.id}))`;
    const current = await tx.competitionProfile.findUnique({
      where: { id: competition.id },
      select: { isPartner: true, isAffiliate: true, decisionsSubmittedAt: true },
    });
    if (!current || current.isPartner || current.isAffiliate) return { error: "This competition no longer supports rolling decisions." };
    if (current.decisionsSubmittedAt) return { error: "This competition's decisions were already submitted." };
    const application = await tx.application.findFirst({
      where: { id: applicationId, competitionId: competition.id, ...visibleApplicationWhere },
      select: { id: true, decisionPublishedAt: true },
    });
    if (!application) return { error: "This application is no longer active." };
    if (application.decisionPublishedAt) return { error: "This decision has already been published and cannot be changed here." };

    await tx.application.update({
      where: { id: application.id },
      data: {
        status: status as "PENDING" | "ACCEPTED" | "DECLINED",
        ...(intent === "publish" ? { decisionPublishedAt: new Date(), teamOfferResponse: "NONE", teamOfferRespondedAt: null } : {}),
      },
    });
    if (intent === "publish" && status === "ACCEPTED") {
      await tx.applicationOfferEvent.create({
        data: { applicationId, actorUserId: user.id, type: "OFFER_PUBLISHED" },
      });
    }
    return { ok: true, message: intent === "publish" ? "Decision published. The team can see it now." : "Draft saved privately." };
  });
  if (result.ok) {
    revalidatePath("/comp/decisions");
    revalidatePath("/comp/applicants");
    revalidatePath("/comp");
    revalidatePath("/team", "layout");
    revalidatePath("/dashboard");
    revalidatePath("/ops/competitions", "layout");
  }
  return result;
}
