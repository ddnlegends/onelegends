import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SLUG = "zzz-live-check";
const EMAIL = "zzz.livecheck@example.com";
const PASSWORD = "CheckLive!143";

async function cleanup() {
  const comp = await prisma.competitionProfile.findUnique({
    where: { slug: SLUG },
    select: { id: true },
  });
  const teams = await prisma.teamProfile.findMany({
    where: { slug: { startsWith: SLUG } },
    select: { id: true },
  });
  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { id: true },
  });
  if (comp) {
    await prisma.competitionProfile.delete({ where: { id: comp.id } });
  }
  for (const team of teams) {
    await prisma.teamProfile.delete({ where: { id: team.id } });
  }
  if (user) {
    await prisma.user.delete({ where: { id: user.id } });
  }
}

async function setup() {
  await cleanup();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      passwordHash,
      name: "Live Check Judge",
      judge: { create: { name: "Live Check Judge" } },
    },
    include: { judge: true },
  });
  const stamp = Date.now().toString(36);
  const teamA = await prisma.teamProfile.create({
    data: {
      slug: `${SLUG}-a`,
      claimCode: `ZZZ-A${stamp}`.slice(0, 12),
      name: "ZZZ Check Team A",
      claimedAt: new Date(),
      avDriveUrl: "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view",
    },
  });
  const teamB = await prisma.teamProfile.create({
    data: {
      slug: `${SLUG}-b`,
      claimCode: `ZZZ-B${stamp}`.slice(0, 12),
      name: "ZZZ Check Team B",
      claimedAt: new Date(),
    },
  });
  const membership = await prisma.teamMembership.create({
    data: {
      userId: user.id,
      teamId: teamA.id,
      status: "APPROVED",
      isAdmin: true,
      isPrimary: true,
      decidedAt: new Date(),
    },
  });
  const competition = await prisma.competitionProfile.create({
    data: {
      slug: SLUG,
      claimCode: `ZZZ-C${stamp}`.slice(0, 12),
      name: "ZZZ Live Check",
      claimedAt: new Date(),
      acceptingApps: false,
      judgingMode: "LIVE",
      requiredJudgeCount: 1,
      livePosition: 1,
      liveStartedAt: new Date(),
    },
  });
  const appA = await prisma.application.create({
    data: { teamId: teamA.id, competitionId: competition.id },
  });
  const appB = await prisma.application.create({
    data: { teamId: teamB.id, competitionId: competition.id },
  });
  await prisma.competitionProfile.update({
    where: { id: competition.id },
    data: { liveOrder: [appA.id, appB.id] },
  });
  const assignment = await prisma.judgeAssignment.create({
    data: {
      judgeId: user.judge.id,
      competitionId: competition.id,
      status: "APPROVED",
      decidedAt: new Date(),
    },
  });
  await prisma.judgeViewingSlot.createMany({
    data: [
      { assignmentId: assignment.id, applicationId: appA.id, position: 1 },
      { assignmentId: assignment.id, applicationId: appB.id, position: 2 },
    ],
  });
  console.log(`READY ${competition.id} ${membership.teamId}`);
}

const mode = process.argv[2] ?? "setup";
const run = mode === "cleanup" ? cleanup : setup;

run()
  .then(() => {
    if (mode === "cleanup") console.log("CLEAN");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
