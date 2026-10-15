import { afterAll, beforeEach, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/app/actions/auth", () => ({ requireUser: async () => identity.userId ? { id: identity.userId, email: "forged@example.org", platformAdmin: true } : null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { submitFeedback, updateFeedbackStatus } from "@/app/actions/feedback";
import { prisma } from "@/lib/prisma";
import { E2E, seedE2E } from "../prisma/e2e-seed";

beforeEach(async () => { await seedE2E(); identity.userId = ""; });
afterAll(async () => { await prisma.$disconnect(); });

async function actAs(role: keyof typeof E2E.emails) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails[role] } });
  identity.userId = user.id;
  return user;
}

function feedback(patch: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ submissionKey: crypto.randomUUID(), category: "QUESTION", message: "Can you help with the application?", pagePath: "/team/apply?private=secret#section", ...patch })) data.set(key, value);
  return data;
}

function status(id: string, value = "IN_PROGRESS") {
  const data = new FormData(); data.set("feedbackId", id); data.set("status", value); return data;
}

it("refuses unauthenticated and deleted accounts, and rejects invalid input", async () => {
  expect(await submitFeedback(undefined, feedback())).toHaveProperty("error");
  await actAs("team");
  const invalid: Record<string, string>[] = [{ message: "  " }, { message: "a".repeat(5001) }, { category: "OTHER" }, { submissionKey: "bad" }];
  for (const patch of invalid) {
    expect(await submitFeedback(undefined, feedback(patch))).toHaveProperty("error");
  }
  identity.userId = "no-such-account";
  expect(await submitFeedback(undefined, feedback())).toHaveProperty("error");
  expect(await prisma.feedback.count()).toBe(0);
});

it("records trusted identity and role context for every user type", async () => {
  const contexts = { team: "Teams:", comp: "Competitions:", judge: "Judging:", moderator: "Moderator:", tech: "Circuit tech admin" } as const;
  for (const role of Object.keys(contexts) as (keyof typeof contexts)[]) {
    const user = await actAs(role);
    const result = await submitFeedback(undefined, feedback({ userId: "someone-else", submitterEmail: "forged@example.org", submitterName: "Fake", accountRole: "COMP", status: "RESOLVED" }));
    expect(result.ok).toBe(true);
    const row = await prisma.feedback.findUniqueOrThrow({ where: { id: result.feedbackId } });
    expect(row).toMatchObject({ userId: user.id, submitterName: user.name, submitterEmail: user.email, accountRole: user.role, status: "NEW", pagePath: "/team/apply" });
    expect(row.accountContext).toContain(contexts[role]);
  }
});

it("deduplicates simultaneous retries and enforces a shared per-user rate limit", async () => {
  await actAs("team");
  const form = feedback();
  const retries = await Promise.all(Array.from({ length: 3 }, () => submitFeedback(undefined, form)));
  expect(retries.every((result) => result.ok)).toBe(true);
  expect(new Set(retries.map((result) => result.feedbackId)).size).toBe(1);
  const results = await Promise.all(Array.from({ length: 6 }, () => submitFeedback(undefined, feedback())));
  expect(results.filter((result) => result.ok)).toHaveLength(4);
  expect(results.filter((result) => result.error)).toHaveLength(2);
  expect(await prisma.feedback.count()).toBe(5);
  expect(await submitFeedback(undefined, form)).toHaveProperty("feedbackId", retries[0].feedbackId);
  await prisma.feedback.updateMany({ data: { createdAt: new Date(Date.now() - 16 * 60_000) } });
  expect(await submitFeedback(undefined, feedback())).toHaveProperty("ok", true);
});

it("only current platform admins can update status and the actor email is authoritative", async () => {
  await actAs("team");
  const submitted = await submitFeedback(undefined, feedback());
  const id = submitted.feedbackId!;
  identity.userId = "";
  expect(await updateFeedbackStatus(undefined, status(id))).toHaveProperty("error");
  for (const role of ["team", "comp", "judge", "moderator"] as const) {
    await actAs(role);
    expect(await updateFeedbackStatus(undefined, status(id))).toHaveProperty("error");
  }
  const admin = await actAs("tech");
  expect(await updateFeedbackStatus(undefined, status(id, "INVALID"))).toHaveProperty("error");
  expect(await updateFeedbackStatus(undefined, status("missing"))).toHaveProperty("error");
  expect(await updateFeedbackStatus(undefined, status(id))).toHaveProperty("ok", true);
  expect(await updateFeedbackStatus(undefined, status(id, "RESOLVED"))).toHaveProperty("ok", true);
  expect(await prisma.feedback.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "RESOLVED", statusUpdatedByEmail: admin.email });
  await prisma.user.update({ where: { id: admin.id }, data: { platformAdmin: false } });
  expect(await updateFeedbackStatus(undefined, status(id, "NEW"))).toHaveProperty("error");
});

it("preserves the contact snapshot when an account is deleted and blocks direct public DB access", async () => {
  const user = await actAs("team");
  const result = await submitFeedback(undefined, feedback());
  await prisma.user.delete({ where: { id: user.id } });
  expect(await prisma.feedback.findUniqueOrThrow({ where: { id: result.feedbackId } })).toMatchObject({ userId: null, submitterEmail: user.email, submitterName: user.name });
  const [table] = await prisma.$queryRaw<{ relrowsecurity: boolean }[]>`SELECT relrowsecurity FROM pg_class WHERE oid = 'public."Feedback"'::regclass`;
  expect(table.relrowsecurity).toBe(true);
  const policies = await prisma.$queryRaw<unknown[]>`SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = 'Feedback'`;
  expect(policies).toHaveLength(0);
});
