/**
 * Reconcile the confirmed assignment sheet against existing Partner Competitions.
 * Dry run by default. --apply writes only after all 21 records and admin identities match.
 */
import { PrismaClient } from "@prisma/client";
import { INITIAL_REG_ASSIGNMENTS, resolveInitialRegAssignments } from "../src/lib/reg-assignments";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const competitions = await prisma.competitionProfile.findMany({
    select: { id: true, name: true, isPartner: true, regAssignment: { select: { email: true } } },
  });
  const { matches, issues } = resolveInitialRegAssignments(competitions);
  const emails = [...new Set(INITIAL_REG_ASSIGNMENTS.map((row) => row.email))];
  const [admins, invites] = await Promise.all([
    prisma.user.findMany({ where: { email: { in: emails }, platformAdmin: true }, select: { email: true } }),
    prisma.platformAdminInvite.findMany({ where: { email: { in: emails } }, select: { email: true } }),
  ]);
  const authorized = new Set([...admins, ...invites].map((row) => row.email.toLowerCase()));
  for (const email of emails) {
    if (!authorized.has(email)) issues.push(`${email}: no tech admin account or pending tech admin invite.`);
  }
  for (const match of matches) {
    const current = competitions.find((comp) => comp.id === match.competitionId)?.regAssignment;
    if (current?.email && current.email !== match.email) {
      issues.push(`${match.competitionName}: already assigned to ${current.email}; refusing to overwrite.`);
    }
  }
  for (const match of matches) {
    console.log(`${match.competitionName} (${match.competitionId}) -> ${match.email}`);
  }
  if (issues.length) {
    console.error(`Assignment check failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    process.exitCode = 1;
    return;
  }
  if (!apply) {
    console.log("All 21 matches verified. Dry run only; pass --apply to save assignments.");
    return;
  }
  await prisma.$transaction(async (tx) => {
    // Prevent concurrent edits to the same competition while the assignments are written.
    for (const match of matches) {
      await tx.$queryRaw`SELECT id FROM "CompetitionProfile" WHERE id = ${match.competitionId} FOR UPDATE`;
      const competition = await tx.competitionProfile.findUnique({
        where: { id: match.competitionId },
        select: { isPartner: true, regAssignment: { select: { email: true } } },
      });
      if (!competition?.isPartner || (competition.regAssignment?.email && competition.regAssignment.email !== match.email)) {
        throw new Error(`${match.competitionName} changed during assignment; no rows were saved.`);
      }
      if (competition.regAssignment?.email === match.email) continue;
      await tx.competitionRegAssignment.upsert({
        where: { competitionId: match.competitionId },
        create: {
          competitionId: match.competitionId,
          email: match.email,
          contactName: match.contactName,
          assignedByEmail: "initial-reg-assignment@desidancenetwork.org",
        },
        update: {
          email: match.email,
          contactName: match.contactName,
          assignedAt: new Date(),
          assignedByEmail: "initial-reg-assignment@desidancenetwork.org",
        },
      });
      await tx.competitionRegAssignmentAudit.create({
        data: {
          competitionId: match.competitionId,
          competitionName: match.competitionName,
          oldEmail: null,
          newEmail: match.email,
          changedByEmail: "initial-reg-assignment@desidancenetwork.org",
        },
      });
    }
  }, { timeout: 60_000 });
  console.log("Saved the 21 Partner Competition Reg assignments.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
