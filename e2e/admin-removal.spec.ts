import { expect } from "@playwright/test";
import { db, E2E, login, test } from "./helpers";

test("circuit ops removes one secondary admin without changing either listing", async ({ page }) => {
  const [team, competition, secondary] = await Promise.all([
    db.teamProfile.findUniqueOrThrow({ where: { slug: E2E.teams.mine.slug } }),
    db.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.showcase.slug } }),
    db.user.findUniqueOrThrow({ where: { email: E2E.emails.moderator } }),
  ]);
  const teamMembership = await db.teamMembership.create({
    data: { teamId: team.id, userId: secondary.id, status: "APPROVED", isAdmin: true },
  });
  const compMembership = await db.competitionMembership.create({
    data: { competitionId: competition.id, userId: secondary.id, status: "APPROVED", isAdmin: true },
  });

  await login(page, "tech");
  await page.goto("/ops/teams");
  const teamRow = page.locator(`#ops-team-${team.id}`);
  await teamRow.locator(":scope > button").click();
  await teamRow.locator("li").filter({ hasText: E2E.emails.moderator })
    .getByRole("button", { name: "Remove" }).click();
  await expect.poll(() => db.teamMembership.findUnique({ where: { id: teamMembership.id } })).toBeNull();
  expect(await db.teamMembership.count({ where: { teamId: team.id, isPrimary: true, status: "APPROVED" } })).toBe(1);
  expect((await db.teamProfile.findUniqueOrThrow({ where: { id: team.id } })).claimCode).toBe(team.claimCode);

  await page.goto("/ops/competitions");
  const compRow = page.locator("article").filter({ hasText: E2E.comps.showcase.name });
  await compRow.locator(":scope > button").click();
  await compRow.locator("li").filter({ hasText: E2E.emails.moderator })
    .getByRole("button", { name: "Remove" }).click();
  await expect.poll(() => db.competitionMembership.findUnique({ where: { id: compMembership.id } })).toBeNull();
  expect((await db.competitionProfile.findUniqueOrThrow({ where: { id: competition.id } })).claimCode).toBe(competition.claimCode);
  expect(await db.moderatorAccess.count({ where: { competitionId: competition.id, userId: secondary.id } })).toBe(1);
});

test("circuit ops chooses an approved replacement when removing a primary", async ({ page }) => {
  const [team, competition, teamUser, moderatorUser] = await Promise.all([
    db.teamProfile.findUniqueOrThrow({ where: { slug: E2E.teams.mine.slug } }),
    db.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.showcase.slug } }),
    db.user.findUniqueOrThrow({ where: { email: E2E.emails.team } }),
    db.user.findUniqueOrThrow({ where: { email: E2E.emails.moderator } }),
  ]);
  const teamReplacement = await db.teamMembership.create({
    data: { teamId: team.id, userId: moderatorUser.id, status: "APPROVED", isAdmin: true },
  });
  const compReplacement = await db.competitionMembership.create({
    data: { competitionId: competition.id, userId: teamUser.id, status: "APPROVED", isAdmin: true },
  });

  await login(page, "tech");
  await page.goto("/ops/teams");
  const teamRow = page.locator(`#ops-team-${team.id}`);
  await teamRow.locator(":scope > button").click();
  await teamRow.getByRole("button", { name: "Remove primary" }).click();
  await teamRow.getByLabel("New primary").selectOption(teamReplacement.id);
  await teamRow.getByRole("button", { name: "Confirm removal" }).click();
  await expect.poll(() => db.teamMembership.findUnique({ where: { id: teamReplacement.id }, select: { isPrimary: true } })).toMatchObject({ isPrimary: true });
  expect(await db.teamMembership.count({ where: { teamId: team.id, userId: teamUser.id } })).toBe(0);
  const teamAfter = await db.teamProfile.findUniqueOrThrow({ where: { id: team.id } });
  expect(teamAfter.claimCode).toBe(team.claimCode);
  expect(teamAfter.claimedAt).not.toBeNull();

  await page.goto("/ops/competitions");
  const compRow = page.locator("article").filter({ hasText: E2E.comps.showcase.name });
  await compRow.locator(":scope > button").click();
  await compRow.getByRole("button", { name: "Remove primary" }).click();
  await compRow.getByLabel("New primary").selectOption(compReplacement.id);
  await compRow.getByRole("button", { name: "Confirm removal" }).click();
  await expect.poll(() => db.competitionProfile.findUnique({ where: { id: competition.id }, select: { userId: true } })).toMatchObject({ userId: teamUser.id });
  expect(await db.competitionMembership.count({ where: { competitionId: competition.id, userId: competition.userId! } })).toBe(0);
  expect((await db.competitionMembership.findUniqueOrThrow({ where: { id: compReplacement.id } })).isPrimary).toBe(true);
  const compAfter = await db.competitionProfile.findUniqueOrThrow({ where: { id: competition.id } });
  expect(compAfter.claimCode).toBe(competition.claimCode);
  expect(compAfter.claimedAt).not.toBeNull();
  expect(await db.judgeAssignment.count({ where: { competitionId: competition.id } })).toBe(1);
});

test("removing a primary without a successor rotates the claim and preserves other access", async ({ page }) => {
  const [team, competition] = await Promise.all([
    db.teamProfile.findUniqueOrThrow({ where: { slug: E2E.teams.mine.slug } }),
    db.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.showcase.slug } }),
  ]);
  await db.teamInvite.create({ data: { teamId: team.id, email: "future-team-admin@example.com" } });
  await db.compInvite.create({ data: { competitionId: competition.id, email: "future-comp-admin@example.com" } });
  const moderator = await db.user.findUniqueOrThrow({ where: { email: E2E.emails.moderator } });
  const remainingAdmin = await db.competitionMembership.create({
    data: { competitionId: competition.id, userId: moderator.id, status: "APPROVED", isAdmin: true },
  });
  await db.competitionProfile.update({ where: { id: competition.id }, data: { judgingOpen: true } });

  await login(page, "tech");
  await page.goto("/ops/teams");
  const teamRow = page.locator(`#ops-team-${team.id}`);
  await teamRow.locator(":scope > button").click();
  await teamRow.getByRole("button", { name: "Remove primary" }).click();
  await expect(teamRow.getByText(/No approved replacement/)).toBeVisible();
  await teamRow.getByRole("button", { name: "Confirm removal" }).click();
  await expect.poll(() => db.teamProfile.findUnique({ where: { id: team.id }, select: { claimedAt: true } })).toMatchObject({ claimedAt: null });
  expect((await db.teamProfile.findUniqueOrThrow({ where: { id: team.id } })).claimCode).not.toBe(team.claimCode);
  expect(await db.teamMembership.count({ where: { teamId: team.id } })).toBe(0);
  expect(await db.teamInvite.count({ where: { teamId: team.id } })).toBe(1);

  await page.goto("/ops/competitions");
  const compRow = page.locator("article").filter({ hasText: E2E.comps.showcase.name });
  await compRow.locator(":scope > button").click();
  await compRow.getByRole("button", { name: "Remove primary" }).click();
  await compRow.getByLabel("New primary").selectOption("unclaimed");
  await compRow.getByRole("button", { name: "Confirm removal" }).click();
  await expect.poll(() => db.competitionProfile.findUnique({ where: { id: competition.id }, select: { userId: true, claimedAt: true } }))
    .toMatchObject({ userId: null, claimedAt: null });
  const compAfter = await db.competitionProfile.findUniqueOrThrow({ where: { id: competition.id } });
  expect(compAfter.claimCode).not.toBe(competition.claimCode);
  expect(compAfter.judgingOpen).toBe(false);
  expect(await db.competitionMembership.count({ where: { competitionId: competition.id } })).toBe(1);
  expect((await db.competitionMembership.findUniqueOrThrow({ where: { id: remainingAdmin.id } })).isPrimary).toBe(false);
  expect(await db.compInvite.count({ where: { competitionId: competition.id } })).toBe(1);
  expect(await db.judgeAssignment.count({ where: { competitionId: competition.id } })).toBe(1);
  expect(await db.moderatorAccess.count({ where: { competitionId: competition.id } })).toBe(1);
});
