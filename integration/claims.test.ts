import { afterAll, beforeEach, expect, it, vi } from "vitest";
const identity = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/app/actions/auth", () => identity);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: vi.fn() }) }));

import { prisma } from "@/lib/prisma";
import { seedE2E, E2E } from "../prisma/e2e-seed";
import { claimAttemptError, CLAIM_ATTEMPT_LIMIT } from "@/lib/claim-rate-limit";
import { previewTeamClaim, previewCompClaim, claimTeamAction, claimCompAction } from "@/app/actions/team-access";

let userId: string;
function form(code: string) {
  const data = new FormData(); data.set("claimCode", code); return data;
}
beforeEach(async () => {
  vi.restoreAllMocks();
  await seedE2E();
  userId = (await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.team } })).id;
  identity.requireUser.mockReset().mockResolvedValue({ id: userId });
});
afterAll(async () => { await prisma.$disconnect(); });

it("allows exactly 20 simultaneous attempts, and isolates different users", async () => {
  const attempts = await Promise.all(Array.from({ length: 30 }, () => claimAttemptError(userId)));
  expect(attempts.filter((error) => error === null)).toHaveLength(CLAIM_ATTEMPT_LIMIT);
  expect(attempts.filter((error) => error !== null)).toHaveLength(10);
  const row = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  expect(row.claimAttemptCount).toBe(CLAIM_ATTEMPT_LIMIT);
  const other = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.comp } });
  expect(await claimAttemptError(other.id)).toBeNull();
});

it("denied requests do not extend cooldown, and an expired window allows a retry", async () => {
  const start = new Date();
  await prisma.user.update({ where: { id: userId }, data: { claimAttemptCount: CLAIM_ATTEMPT_LIMIT, claimAttemptWindowStart: start } });
  expect(await claimAttemptError(userId)).toMatch(/Too many/);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).claimAttemptWindowStart).toEqual(start);
  await prisma.user.update({ where: { id: userId }, data: { claimAttemptWindowStart: new Date(Date.now() - 16 * 60_000) } });
  expect(await claimAttemptError(userId)).toBeNull();
  expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).claimAttemptCount).toBe(1);
});

it("all four claim/preview actions consume one shared budget", async () => {
  for (const action of [previewTeamClaim, previewCompClaim, claimTeamAction, claimCompAction]) {
    expect(await action(undefined, form("invalid-code"))).toHaveProperty("error");
  }
  expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).claimAttemptCount).toBe(4);
  await prisma.user.update({ where: { id: userId }, data: { claimAttemptCount: CLAIM_ATTEMPT_LIMIT } });
  const team = await prisma.teamProfile.create({ data: { name: "Unclaimed", slug: "unclaimed", claimCode: "TEAM-FIXTURE" } });
  for (const action of [previewTeamClaim, previewCompClaim, claimTeamAction, claimCompAction]) {
    expect(await action(undefined, form(team.claimCode))).toHaveProperty("error", expect.stringMatching(/Too many/));
  }
  expect((await prisma.teamProfile.findUniqueOrThrow({ where: { id: team.id } })).claimedAt).toBeNull();
});

it("refuses a missing user or unavailable limiter without looking up claim codes", async () => {
  expect(await claimAttemptError("does-not-exist")).toMatch(/Too many/);
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("simulated failure"));
  const lookup = vi.spyOn(prisma.teamProfile, "findUnique");
  expect(await claimTeamAction(undefined, form("TEAM-FIXTURE"))).toHaveProperty("error", expect.stringMatching(/temporarily unavailable/));
  expect(lookup).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledWith("claim_rate_limit_unavailable");
});

it("two simultaneous team claims leave exactly one primary owner", async () => {
  const other = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.comp } });
  const team = await prisma.teamProfile.create({ data: { name: "Race Team", slug: "race-team", claimCode: "TEAM-RACE" } });
  identity.requireUser.mockResolvedValueOnce({ id: userId }).mockResolvedValueOnce({ id: other.id });
  const results = await Promise.all([claimTeamAction(undefined, form(team.claimCode)), claimTeamAction(undefined, form(team.claimCode))]);
  expect(results.filter((r) => r.ok)).toHaveLength(1);
  expect(results.filter((r) => r.error)).toHaveLength(1);
  expect(await prisma.teamMembership.count({ where: { teamId: team.id, isPrimary: true, status: "APPROVED" } })).toBe(1);
});

it("two simultaneous competition claims leave one primary and matching legacy owner", async () => {
  const other = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.comp } });
  const comp = await prisma.competitionProfile.create({ data: { name: "Race Comp", slug: "race-comp", claimCode: "COMP-RACE" } });
  identity.requireUser.mockResolvedValueOnce({ id: userId }).mockResolvedValueOnce({ id: other.id });
  const results = await Promise.all([claimCompAction(undefined, form(comp.claimCode)), claimCompAction(undefined, form(comp.claimCode))]);
  expect(results.filter((r) => r.ok)).toHaveLength(1);
  expect(results.filter((r) => r.error)).toHaveLength(1);
  const memberships = await prisma.competitionMembership.findMany({ where: { competitionId: comp.id, isPrimary: true } });
  expect(memberships).toHaveLength(1);
  expect((await prisma.competitionProfile.findUniqueOrThrow({ where: { id: comp.id } })).userId).toBe(memberships[0].userId);
});

it("a code rotated between lookup and transaction cannot claim a team", async () => {
  const team = await prisma.teamProfile.create({ data: { name: "Rotate Team", slug: "rotate-team", claimCode: "TEAM-OLD" } });
  const transaction = prisma.$transaction.bind(prisma);
  vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (...args: Parameters<typeof prisma.$transaction>) => {
    await prisma.teamProfile.update({ where: { id: team.id }, data: { claimCode: "TEAM-NEW" } });
    return transaction(...args);
  });
  expect(await claimTeamAction(undefined, form(team.claimCode))).toHaveProperty("error");
  expect((await prisma.teamProfile.findUniqueOrThrow({ where: { id: team.id } })).claimedAt).toBeNull();
  expect(await prisma.teamMembership.count({ where: { teamId: team.id } })).toBe(0);
});

it("a code rotated between lookup and transaction cannot claim a competition", async () => {
  const comp = await prisma.competitionProfile.create({ data: { name: "Rotate Comp", slug: "rotate-comp", claimCode: "COMP-OLD" } });
  const transaction = prisma.$transaction.bind(prisma);
  vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (...args: Parameters<typeof prisma.$transaction>) => {
    await prisma.competitionProfile.update({ where: { id: comp.id }, data: { claimCode: "COMP-NEW" } });
    return transaction(...args);
  });
  expect(await claimCompAction(undefined, form(comp.claimCode))).toHaveProperty("error");
  const after = await prisma.competitionProfile.findUniqueOrThrow({ where: { id: comp.id } });
  expect(after.claimedAt).toBeNull();
  expect(after.userId).toBeNull();
  expect(await prisma.competitionMembership.count({ where: { competitionId: comp.id } })).toBe(0);
});
