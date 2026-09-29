-- AlterTable
ALTER TABLE "CompetitionProfile" ADD COLUMN "judgingOpen" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CompetitionProfile" DROP COLUMN "judgingMode";
ALTER TABLE "CompetitionProfile" DROP COLUMN "livePosition";
ALTER TABLE "CompetitionProfile" DROP COLUMN "liveStartedAt";
ALTER TABLE "CompetitionProfile" DROP COLUMN "liveOrder";

DROP TYPE "JudgingMode";
