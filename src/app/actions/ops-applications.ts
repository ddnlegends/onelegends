"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";
import { isCompetitionOpen } from "@/lib/judging-rules";
import { isPlatformAdmin } from "@/lib/team-access";

type RemovalResult = { error?: string; ok?: boolean; message?: string };

/** Remove an applicant during payment review, before an anonymous judging order exists. */
export async function removeCompetitionApplication(
  _prev: RemovalResult | undefined,
  formData: FormData,
): Promise<RemovalResult> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (!(await isPlatformAdmin(user.id))) {
    return { error: "Only tech admins can remove applications." };
  }

  const competitionId = formData.get("competitionId");
  const applicationId = formData.get("applicationId");
  if (typeof competitionId !== "string" || !competitionId ||
      typeof applicationId !== "string" || !applicationId) {
    return { error: "Choose an application to remove." };
  }

  const result = await prisma.$transaction(async (tx): Promise<RemovalResult> => {
    // Judging order creation uses the same lock. Recheck the stage inside it.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${competitionId}))`;
    // Serialize with profile changes while checking whether applications reopened.
    await tx.$queryRaw`SELECT id FROM "CompetitionProfile" WHERE id = ${competitionId} FOR UPDATE`;
    const competition = await tx.competitionProfile.findUnique({
      where: { id: competitionId },
    });
    if (!competition) return { error: "Competition not found." };
    if (isCompetitionOpen(competition)) {
      return { error: "Close applications before removing unpaid teams." };
    }
    if (competition.judgingOpen || competition.resultsReleasedAt) {
      return { error: "Applications cannot be removed after judging starts." };
    }

    const [orderedApplications, viewingSlots] = await Promise.all([
      tx.application.count({ where: { competitionId, viewingPosition: { not: null } } }),
      tx.judgeViewingSlot.count({ where: { assignment: { competitionId } } }),
    ]);
    if (orderedApplications || viewingSlots) {
      return { error: "Applications cannot be removed after the judging order is created." };
    }

    const application = await tx.application.findFirst({
      where: { id: applicationId, competitionId },
      select: {
        id: true,
        team: { select: { name: true } },
      },
    });
    if (!application) return { error: "Application not found for this competition." };

    await tx.application.delete({ where: { id: application.id } });
    return { ok: true, message: `${application.team.name} was removed from this competition.` };
  });
  if (!result.ok) return result;

  revalidatePath("/ops/comps", "layout");
  revalidatePath("/ops/competitions", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/team");
  revalidatePath("/comp/applicants");
  revalidatePath("/comp");
  return result;
}
