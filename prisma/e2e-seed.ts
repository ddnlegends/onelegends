/**
 * Fixture data for the Playwright suite (`npm run test:e2e`).
 *
 * Wipes every app table, so it refuses to run unless DATABASE_URL points at a
 * loopback onelegends_e2e database with explicit reset opt-in and a safe DIRECT_URL. Every fixture account signs in
 * with the password in E2E_PASSWORD; the emails must stay in the legacy
 * allowlist in src/lib/auth-policy.ts because only those may use passwords.
 */
import { PrismaClient } from "@prisma/client";
import { assertDisposableDatabase } from "../src/lib/test-environment";
import bcrypt from "bcryptjs";

export const E2E = {
  emails: {
    tech: "legendstestadmin@gmail.com",
    comp: "legendstestcomp@gmail.com",
    team: "legendstestuser@gmail.com",
    moderator: "legendstestmoderator@gmail.com",
    judge: "legendstestjudge@gmail.com",
  },
  comps: {
    open: { slug: "e2e-open-call", name: "E2E Open Call", claimCode: "COMP-E2EOPN" },
    closed: { slug: "e2e-closed-call", name: "E2E Closed Call", claimCode: "COMP-E2ECLS" },
    showcase: { slug: "e2e-showcase", name: "E2E Showcase", claimCode: "COMP-E2ESHW" },
  },
  teams: {
    mine: { slug: "e2e-crew", name: "E2E Crew", claimCode: "TEAM-E2ECRW" },
    alpha: { slug: "crew-alpha", name: "Crew Alpha", claimCode: "TEAM-E2EALF" },
    beta: { slug: "crew-beta", name: "Crew Beta", claimCode: "TEAM-E2EBTA" },
  },
} as const;

const DRIVE_FILE = "https://drive.google.com/file/d/1E2EfixtureVideoIdAAAAAAAAAAAAA/view";

function completeTeam(team: { slug: string; name: string; claimCode: string }) {
  return {
    ...team,
    claimedAt: new Date(),
    photoUrl: "https://example.org/e2e-team.jpg",
    blurb: `${team.name} is a fixture team for automated tests.`,
    avDriveUrl: DRIVE_FILE,
    captains: "Test Captain",
    yearsEstablished: 2020,
    rosterSize: 2,
    dancers: {
      create: [
        { name: "Dancer One", tshirtSize: "M", inAV: true },
        { name: "Dancer Two", tshirtSize: "L", inAV: true },
      ],
    },
  };
}

async function wipe(prisma: PrismaClient) {
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

export async function seedE2E() {
  assertDisposableDatabase();
  const password = process.env.E2E_PASSWORD;
  if (!password) throw new Error("Set E2E_PASSWORD before seeding.");

  const prisma = new PrismaClient();
  try {
    await wipe(prisma);
    const passwordHash = await bcrypt.hash(password, 10);
    const user = (email: string, name: string, platformAdmin = false) =>
      prisma.user.create({ data: { email, name, passwordHash, platformAdmin } });

    await user(E2E.emails.tech, "E2E Tech Admin", true);
    const compAdmin = await user(E2E.emails.comp, "E2E Comp Admin");
    const teamAdmin = await user(E2E.emails.team, "E2E Team Admin");
    const moderator = await user(E2E.emails.moderator, "E2E Moderator");
    const judgeUser = await user(E2E.emails.judge, "E2E Judge");

    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    await prisma.competitionProfile.create({
      data: {
        ...E2E.comps.open,
        claimedAt: new Date(),
        acceptingApps: true,
        applicationDeadline: nextMonth,
        dates: "Fixture dates",
        location: "Test City",
        venue: "Test Hall",
      },
    });
    await prisma.competitionProfile.create({
      data: {
        ...E2E.comps.closed,
        claimedAt: new Date(),
        acceptingApps: false,
        applicationDeadline: lastMonth,
      },
    });
    const showcase = await prisma.competitionProfile.create({
      data: {
        ...E2E.comps.showcase,
        claimedAt: new Date(),
        userId: compAdmin.id,
        acceptingApps: false,
        applicationDeadline: lastMonth,
        requiredJudgeCount: 1,
        memberships: {
          create: {
            userId: compAdmin.id,
            status: "APPROVED",
            isAdmin: true,
            isPrimary: true,
            decidedAt: new Date(),
          },
        },
      },
    });

    await prisma.teamProfile.create({
      data: {
        ...completeTeam(E2E.teams.mine),
        memberships: {
          create: {
            userId: teamAdmin.id,
            status: "APPROVED",
            isAdmin: true,
            isPrimary: true,
            decidedAt: new Date(),
          },
        },
      },
    });
    for (const fixture of [E2E.teams.alpha, E2E.teams.beta]) {
      await prisma.teamProfile.create({
        data: {
          ...completeTeam(fixture),
          applications: { create: { competitionId: showcase.id } },
        },
      });
    }

    await prisma.moderatorAccess.create({
      data: { userId: moderator.id, competitionId: showcase.id },
    });
    await prisma.judgeProfile.create({
      data: {
        userId: judgeUser.id,
        name: "E2E Judge",
        assignments: {
          create: {
            competitionId: showcase.id,
            status: "APPROVED",
            decidedAt: new Date(),
          },
        },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith("e2e-seed.ts")) {
  seedE2E()
    .then(() => console.log("E2E fixtures seeded."))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
