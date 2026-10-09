import { afterAll, beforeEach, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/app/actions/auth", () => ({ requireUser: async () => identity.userId ? { id: identity.userId } : null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { prisma } from "@/lib/prisma";
import { setApplicationStatus } from "@/app/actions/comp";
import { E2E, seedE2E } from "../prisma/e2e-seed";

beforeEach(async () => {
  await seedE2E();
  identity.userId = (await prisma.user.findUniqueOrThrow({
    where: { email: E2E.emails.comp },
    select: { id: true },
  })).id;
});
afterAll(async () => { await prisma.$disconnect(); });

it("allows application decisions only after results release", async () => {
  const application = await prisma.application.findFirstOrThrow({
    where: { competition: { slug: E2E.comps.showcase.slug } },
    select: { id: true, status: true, competitionId: true },
  });
  expect(await setApplicationStatus(application.id, "ACCEPTED")).toHaveProperty("error");
  expect((await prisma.application.findUniqueOrThrow({ where: { id: application.id } })).status).toBe(application.status);

  await prisma.competitionProfile.update({
    where: { id: application.competitionId },
    data: { resultsReleasedAt: new Date() },
  });
  expect(await setApplicationStatus(application.id, "ACCEPTED")).toEqual({});
  expect((await prisma.application.findUniqueOrThrow({ where: { id: application.id } })).status).toBe("ACCEPTED");
});

it("rejects a moderator without competition admin membership", async () => {
  identity.userId = (await prisma.user.findUniqueOrThrow({
    where: { email: E2E.emails.moderator },
    select: { id: true },
  })).id;
  const application = await prisma.application.findFirstOrThrow({
    where: { competition: { slug: E2E.comps.showcase.slug } },
    select: { id: true },
  });
  expect(await setApplicationStatus(application.id, "ACCEPTED")).toHaveProperty("error");
});
