ALTER TYPE "JudgeRequestStatus" ADD VALUE 'REMOVED';

ALTER TABLE "CompetitionProfile"
ADD COLUMN "resultsFinalizedByEmail" TEXT;

ALTER TABLE "JudgeAssignment"
ADD COLUMN "removedAt" TIMESTAMP(3),
ADD COLUMN "removedByEmail" TEXT,
ADD COLUMN "removalReason" TEXT NOT NULL DEFAULT '';
