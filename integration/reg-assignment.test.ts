import { afterAll, beforeEach, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({ userId: "", email: "" }));
vi.mock("@/app/actions/auth", () => ({ requireUser: async () => identity.userId ? { id: identity.userId, email: identity.email } : null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { E2E, seedE2E } from "../prisma/e2e-seed";
import { prisma } from "@/lib/prisma";
import { setRegAssignment } from "@/app/actions/reg";
import { setCompetitionPartnerStatus } from "@/app/actions/team-access";

beforeEach(async () => { await seedE2E(); identity.userId = ""; identity.email = ""; });
afterAll(async () => { await prisma.$disconnect(); });

it("only tech admins assign Partner Competitions and conversion to Non-partner clears the assignment", async () => {
  const competition = await prisma.competitionProfile.create({ data: {
    name: "Reg Test Comp", slug: "reg-test-comp", claimCode: "COMP-REGTEST", isPartner: true,
  } });
  const tech = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } });
  const host = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.comp } });
  const contactEmail = "rithika.shenoy@desidancenetwork.org";
  await prisma.platformAdminInvite.create({ data: { email: contactEmail } });
  const assign = new FormData();
  assign.set("competitionId", competition.id);
  assign.set("email", contactEmail);

  identity.userId = host.id; identity.email = host.email;
  expect(await setRegAssignment(undefined, assign)).toHaveProperty("error");
  identity.userId = tech.id; identity.email = tech.email;
  expect(await setRegAssignment(undefined, assign)).toMatchObject({ ok: true });
  expect(await prisma.competitionRegAssignment.findUnique({ where: { competitionId: competition.id } })).toMatchObject({ email: contactEmail });

  const changeType = new FormData();
  changeType.set("competitionId", competition.id);
  changeType.set("type", "non-partner");
  expect(await setCompetitionPartnerStatus(undefined, changeType)).toMatchObject({ ok: true });
  expect(await prisma.competitionRegAssignment.findUnique({ where: { competitionId: competition.id } })).toMatchObject({ email: null });
  expect(await prisma.competitionRegAssignmentAudit.count({ where: { competitionId: competition.id } })).toBe(2);
  expect((await prisma.competitionProfile.findUniqueOrThrow({ where: { id: competition.id } })).isPartner).toBe(false);
  expect(await setRegAssignment(undefined, assign)).toHaveProperty("error");
});
