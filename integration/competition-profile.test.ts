import { afterAll, beforeEach, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/app/actions/auth", () => ({ requireUser: async () => identity.userId ? { id: identity.userId } : null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { saveCompProfile } from "@/app/actions/comp";
import { applyToCompetitions } from "@/app/actions/team";
import { prisma } from "@/lib/prisma";
import { E2E, seedE2E } from "../prisma/e2e-seed";

beforeEach(async () => { await seedE2E(); });
afterAll(async () => { await prisma.$disconnect(); });

function detailsForm(stageSize: string) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    dates: "TBD",
    location: "Test City",
    venue: "N/A",
    stageSize,
    lighting: "TBD",
    productionNotes: "N/A",
    description: "Fixture competition details",
    earlyApplicationDeadline: "",
    applicationDeadline: "",
    acceptingApps: "on",
  })) data.set(key, value);
  return data;
}

it("keeps an incomplete competition hidden and rejects a direct application until details are complete", async () => {
  const competition = await prisma.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.showcase.slug } });
  const teamUser = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.team } });
  const compUser = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.comp } });
  await prisma.competitionProfile.update({
    where: { id: competition.id },
    data: { stageSize: "", acceptingApps: true, applicationDeadline: null },
  });
  const selection = new FormData();
  selection.append("competitionId", competition.id);

  identity.userId = teamUser.id;
  expect(await applyToCompetitions(undefined, selection)).toHaveProperty("error");
  expect(await prisma.application.count({ where: { competitionId: competition.id, team: { slug: E2E.teams.mine.slug } } })).toBe(0);

  identity.userId = compUser.id;
  expect(await saveCompProfile(undefined, detailsForm(""))).toMatchObject({ ok: true, message: expect.stringContaining("hidden from teams") });
  expect(await prisma.competitionProfile.findUniqueOrThrow({ where: { id: competition.id } })).toMatchObject({ acceptingApps: false });
  expect(await saveCompProfile(undefined, detailsForm("40 x 32 feet"))).toMatchObject({ ok: true, message: expect.stringContaining("applications are open") });

  identity.userId = teamUser.id;
  expect(await applyToCompetitions(undefined, selection)).toMatchObject({ ok: true });
  expect(await prisma.application.count({ where: { competitionId: competition.id, team: { slug: E2E.teams.mine.slug } } })).toBe(1);
});
