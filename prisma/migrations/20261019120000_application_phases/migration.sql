CREATE TYPE "ApplicationPhase" AS ENUM ('EARLY', 'REGULAR', 'LATE');

ALTER TABLE "CompetitionProfile"
  ADD COLUMN "earlyTierDeadline" TIMESTAMP(3),
  ADD COLUMN "earlyApplicationFeeCents" INTEGER,
  ADD COLUMN "applicationClosesAt" TIMESTAMP(3);

ALTER TABLE "Application"
  ADD COLUMN "appliedPhase" "ApplicationPhase",
  ADD COLUMN "expectedFeeCents" INTEGER;
