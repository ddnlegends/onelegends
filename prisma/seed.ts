import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SEASON_COMPS } from "./season-comps";

const prisma = new PrismaClient();

async function wipeAppData() {
  await prisma.judgeScore.deleteMany();
  await prisma.judgeViewingSlot.deleteMany();
  await prisma.judgeAssignment.deleteMany();
  await prisma.judgeProfile.deleteMany();
  await prisma.judgeInvite.deleteMany();
  await prisma.application.deleteMany();
  await prisma.dancer.deleteMany();
  await prisma.teamInvite.deleteMany();
  await prisma.teamMembership.deleteMany();
  await prisma.teamPhotoBlob.deleteMany();
  await prisma.teamProfile.deleteMany();
  await prisma.compInvite.deleteMany();
  await prisma.competitionMembership.deleteMany();
  await prisma.moderatorInvite.deleteMany();
  await prisma.moderatorAccess.deleteMany();
  await prisma.platformAdminInvite.deleteMany();
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
        description: `${comp.name} — ${comp.location}. Claim this listing with the official partner code after you log in, then run anonymous viewing.`,
        applicationDeadline:
          comp.acceptingApps === false
            ? new Date("2025-11-01T23:59:00")
            : new Date("2026-10-01T23:59:00"),
        requiredJudgeCount: 3,
      },
    });
  }

  const passwordHash = await bcrypt.hash("onelegends@143", 10);
  await prisma.user.create({
    data: {
      email: "legendstech@desidancenetwork.org",
      passwordHash,
      role: "TEAM",
      name: "Legends Admin",
      platformAdmin: true,
    },
  });

  await prisma.user.create({
    data: {
      email: "legendstestmoderator@gmail.com",
      passwordHash: await bcrypt.hash("LegendsModerator@123", 10),
      role: "TEAM",
      name: "Test Moderator",
    },
  });

  console.log(
    `Reset complete. ${SEASON_COMPS.length} partner listings seeded, unclaimed.`,
  );
  console.log(
    "Team circuit ops: legendstech@desidancenetwork.org (Legends Admin). No dance teams until ops creates a team and hands out a claim code.",
  );
  console.log(
    "Test Moderator: legendstestmoderator@gmail.com. Grant moderator access for a competition from the circuit ops dashboard.",
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
