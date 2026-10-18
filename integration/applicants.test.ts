import { afterAll, beforeEach, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/app/actions/auth", () => ({ requireUser: async () => identity.userId ? { id: identity.userId } : null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { prisma } from "@/lib/prisma";
import { saveCompApplicantDecisions } from "@/app/actions/comp";
import { teamVisibleApplicationStatus } from "@/lib/application-decisions";
import { E2E, seedE2E } from "../prisma/e2e-seed";

beforeEach(async () => {
  await seedE2E();
  identity.userId = (await prisma.user.findUniqueOrThrow({
    where: { email: E2E.emails.comp },
    select: { id: true },
  })).id;
});
afterAll(async () => { await prisma.$disconnect(); });

function decisionForm(decisions: { applicationId: string; status: string }[], intent: string, acknowledge = false) {
  const form = new FormData();
  form.set("decisions", JSON.stringify(decisions));
  form.set("intent", intent);
  if (acknowledge) form.set("acknowledgeFinal", "on");
  return form;
}

it("hides drafts and reveals only a complete, acknowledged final batch", async () => {
  const applications = await prisma.application.findMany({
    where: { competition: { slug: E2E.comps.showcase.slug } },
    select: { id: true, status: true, competitionId: true },
  });
  const decisions = applications.map((app, index) => ({ applicationId: app.id, status: index === 0 ? "ACCEPTED" : "WAITLISTED" }));
  expect(await saveCompApplicantDecisions(undefined, decisionForm(decisions, "draft"))).toHaveProperty("error");
  expect((await prisma.application.findUniqueOrThrow({ where: { id: applications[0].id } })).status).toBe(applications[0].status);

  await prisma.competitionProfile.update({
    where: { id: applications[0].competitionId },
    data: { resultsReleasedAt: new Date() },
  });
  expect(await saveCompApplicantDecisions(undefined, decisionForm(decisions, "draft"))).toMatchObject({ ok: true });
  const draft = await prisma.application.findUniqueOrThrow({ where: { id: applications[0].id }, include: { competition: true } });
  expect(draft.status).toBe("ACCEPTED");
  expect(teamVisibleApplicationStatus(draft.status, draft.competition.decisionsSubmittedAt)).toBe("PENDING");
  expect(await saveCompApplicantDecisions(undefined, decisionForm(decisions, "final"))).toHaveProperty("error");
  expect(await saveCompApplicantDecisions(undefined, decisionForm([
    decisions[0], { applicationId: decisions[1].applicationId, status: "PENDING" },
  ], "final", true))).toHaveProperty("error");
  expect(await saveCompApplicantDecisions(undefined, decisionForm(decisions.slice(0, 1), "final", true))).toHaveProperty("error");
  expect(await saveCompApplicantDecisions(undefined, decisionForm(decisions, "final", true))).toMatchObject({ ok: true });
  const finalized = await prisma.competitionProfile.findUniqueOrThrow({ where: { id: applications[0].competitionId } });
  expect(finalized.decisionsSubmittedAt).not.toBeNull();
  expect(teamVisibleApplicationStatus("ACCEPTED", finalized.decisionsSubmittedAt)).toBe("ACCEPTED");
  expect(await saveCompApplicantDecisions(undefined, decisionForm(decisions, "draft"))).toHaveProperty("error");
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
  expect(await saveCompApplicantDecisions(undefined, decisionForm([{ applicationId: application.id, status: "ACCEPTED" }], "draft"))).toHaveProperty("error");
});
