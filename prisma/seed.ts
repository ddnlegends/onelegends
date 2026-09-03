import { PrismaClient } from "@prisma/client";
import { SEASON_COMPS } from "./season-comps";

const prisma = new PrismaClient();

async function wipeAppData() {
  await prisma.judgeScore.deleteMany();
  await prisma.judgeViewingSlot.deleteMany();
  await prisma.judgeAssignment.deleteMany();
  await prisma.judgeProfile.deleteMany();
  await prisma.application.deleteMany();
  await prisma.dancer.deleteMany();
  await prisma.teamProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.competitionProfile.deleteMany();
}

async function main() {
  await wipeAppData();

  for (const comp of SEASON_COMPS) {
    await prisma.competitionProfile.create({
      data: {
        slug: comp.slug,
        name: comp.name,
        claimCode: comp.claimCode,
        acceptingApps: comp.acceptingApps ?? true,
        dates: comp.dates,
        eventDate: comp.eventDate,
        location: comp.location,
        venue: comp.venue,
        stageSize: "TBA",
        productionNotes: "Payment is handled off this site.",
        lighting: "TBA",
        description: `${comp.name} — ${comp.location}. Claim this listing with the official bid code, then run anonymous viewing.`,
        applicationDeadline:
          comp.acceptingApps === false
            ? new Date("2025-11-01T23:59:00")
            : new Date("2026-10-01T23:59:00"),
        requiredJudgeCount: 3,
      },
    });
  }

  console.log(
    `Reset complete. ${SEASON_COMPS.length} bid listings seeded, unclaimed. No team, judge, or comp users.`,
  );
  console.log("Comp accounts register with a claim code from COMP_CODES.md.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
