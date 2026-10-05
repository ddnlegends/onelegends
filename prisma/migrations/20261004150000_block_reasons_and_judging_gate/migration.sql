ALTER TABLE "TeamProfile" ADD COLUMN "applyBlockReason" TEXT NOT NULL DEFAULT '';

-- Older competitions could retain acceptingApps=true after a deadline while
-- judging was open. Normalize those rows before enforcing the invariant.
UPDATE "CompetitionProfile"
SET "acceptingApps" = false
WHERE "judgingOpen" = true;

ALTER TABLE "CompetitionProfile"
ADD CONSTRAINT "CompetitionProfile_no_apps_during_judging"
CHECK (NOT ("acceptingApps" AND "judgingOpen"));
