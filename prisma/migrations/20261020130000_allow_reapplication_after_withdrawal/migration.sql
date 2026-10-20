DROP INDEX "public"."Application_teamId_competitionId_key";

CREATE UNIQUE INDEX "Application_active_team_competition_key"
  ON "public"."Application"("teamId", "competitionId")
  WHERE "removedAt" IS NULL;
