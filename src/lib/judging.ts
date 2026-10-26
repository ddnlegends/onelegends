/**
 * Server-side judging helpers: the shared anonymous viewing order and each
 * judge's viewing slots. The pure rules (rubric, lifecycle gates, score math)
 * live in `src/lib/judging-rules.ts` and are re-exported here; client
 * components must import from `judging-rules` because this file uses Prisma.
 * Release logic lives in `src/lib/release.ts`.
 */
import { prisma } from "@/lib/prisma";
import { shuffleCopy } from "@/lib/judging-rules";
import { viewingEligibleApplicationWhere } from "@/lib/payment-eligibility";

export * from "@/lib/judging-rules";

type OrderRow = { id: string; viewingPosition: number | null };
type SlotRow = { id: string; applicationId: string; position: number };

function slotsMatchOrder(slots: SlotRow[], order: OrderRow[]): boolean {
  if (order.some((app) => app.viewingPosition == null)) return false;
  if (slots.length !== order.length) return false;
  const want = new Map(order.map((app) => [app.id, app.viewingPosition]));
  return slots.every((slot) => want.get(slot.applicationId) === slot.position);
}

/**
 * One shuffled team order per competition. Every judge's slots copy it, so
 * "Team 3" is the same team for every judge and for Moderator.
 */
export async function ensureSharedViewingOrder(
  competitionId: string,
  onlyAssignmentId?: string,
) {
  const [competition, allEligible, assignments, existingOrder] = await Promise.all([
    prisma.competitionProfile.findUnique({
      where: { id: competitionId },
      select: { registrationPaidAt: true },
    }),
    prisma.application.findMany({
      where: { competitionId, ...viewingEligibleApplicationWhere },
      select: { id: true, viewingPosition: true },
    }),
    prisma.judgeAssignment.findMany({
      where: {
        competitionId,
        status: "APPROVED",
        ...(onlyAssignmentId ? { id: onlyAssignmentId } : {}),
      },
      select: {
        id: true,
        slots: { select: { id: true, applicationId: true, position: true } },
      },
    }),
    prisma.application.findFirst({ where: { competitionId, viewingPosition: { not: null } }, select: { id: true } }),
  ]);
  if (!competition) return;
  // Do not create a roster until the competition's OneLegends fee is verified.
  // An existing frozen roster is left alone.
  if (!existingOrder && !competition.registrationPaidAt) return;
  // Once positions exist, the roster is frozen. Later payment changes cannot add AVs.
  const order = existingOrder
    ? allEligible.filter((app) => app.viewingPosition != null)
    : allEligible;
  if (order.length === 0) return;
  const orderReady = order.every((app) => app.viewingPosition != null);
  if (
    orderReady &&
    assignments.every((row) => slotsMatchOrder(row.slots, order))
  ) {
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      // Serializes concurrent page loads that would otherwise race on positions.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${competitionId}))`;

      const [allApps, existing, paid] = await Promise.all([
        tx.application.findMany({
        where: { competitionId, ...viewingEligibleApplicationWhere },
        select: { id: true, viewingPosition: true },
        }),
        tx.application.findFirst({ where: { competitionId, viewingPosition: { not: null } }, select: { id: true } }),
        tx.competitionProfile.findUnique({
          where: { id: competitionId },
          select: { registrationPaidAt: true },
        }),
      ]);
      if (!existing && !paid?.registrationPaidAt) return;
      const apps = existing
        ? allApps.filter((app) => app.viewingPosition != null)
        : allApps;
      const missing = apps.filter((app) => app.viewingPosition == null);
      if (missing.length) {
        let next = apps.reduce(
          (max, app) => Math.max(max, app.viewingPosition ?? 0),
          0,
        );
        for (const app of shuffleCopy(missing)) {
          next += 1;
          await tx.application.update({
            where: { id: app.id },
            data: { viewingPosition: next },
          });
          app.viewingPosition = next;
        }
      }
      const want = new Map(apps.map((app) => [app.id, app.viewingPosition as number]));

      const rows = await tx.judgeAssignment.findMany({
        where: {
          competitionId,
          status: "APPROVED",
          ...(onlyAssignmentId ? { id: onlyAssignmentId } : {}),
        },
        select: {
          id: true,
          slots: { select: { id: true, applicationId: true, position: true } },
        },
      });
      for (const row of rows) {
        const wrong = row.slots.filter(
          (slot) => want.get(slot.applicationId) !== slot.position,
        );
        // Park mismatched slots on negative positions first so the
        // (assignmentId, position) unique index never collides mid-swap.
        for (const [index, slot] of wrong.entries()) {
          await tx.judgeViewingSlot.update({
            where: { id: slot.id },
            data: { position: -(index + 1) },
          });
        }
        for (const slot of wrong) {
          const position = want.get(slot.applicationId);
          if (position == null) continue;
          await tx.judgeViewingSlot.update({
            where: { id: slot.id },
            data: { position },
          });
        }
        const have = new Set(row.slots.map((slot) => slot.applicationId));
        const toCreate = apps.filter((app) => !have.has(app.id));
        if (toCreate.length) {
          await tx.judgeViewingSlot.createMany({
            data: toCreate.map((app) => ({
              assignmentId: row.id,
              applicationId: app.id,
              position: app.viewingPosition as number,
            })),
            skipDuplicates: true,
          });
        }
      }
    },
    { maxWait: 15000, timeout: 30000 },
  );
}

export async function ensureViewingSlots(assignmentId: string) {
  const assignment = await prisma.judgeAssignment.findUnique({
    where: { id: assignmentId },
    select: { competitionId: true, status: true },
  });
  if (!assignment || assignment.status !== "APPROVED") return;
  await ensureSharedViewingOrder(assignment.competitionId, assignmentId);
}

export async function ensureCompetitionJudgeSlots(competitionId: string) {
  await ensureSharedViewingOrder(competitionId);
}
