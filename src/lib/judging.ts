/**
 * Server-side judging helpers: the shared anonymous viewing order and each
 * judge's viewing slots. The pure rules (rubric, lifecycle gates, score math)
 * live in `src/lib/judging-rules.ts` and are re-exported here; client
 * components must import from `judging-rules` because this file uses Prisma.
 * Release logic lives in `src/lib/release.ts`.
 */
import { prisma } from "@/lib/prisma";
import { shuffleCopy } from "@/lib/judging-rules";

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
  const [order, assignments] = await Promise.all([
    prisma.application.findMany({
      where: { competitionId },
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
  ]);
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

      const apps = await tx.application.findMany({
        where: { competitionId },
        select: { id: true, viewingPosition: true },
      });
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
