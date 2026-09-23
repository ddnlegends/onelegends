-- CreateEnum
CREATE TYPE "JudgingMode" AS ENUM ('ASYNC', 'LIVE');

-- AlterTable
ALTER TABLE "CompetitionProfile" ADD COLUMN "judgingMode" "JudgingMode" NOT NULL DEFAULT 'ASYNC';
ALTER TABLE "CompetitionProfile" ADD COLUMN "livePosition" INTEGER;
ALTER TABLE "CompetitionProfile" ADD COLUMN "liveStartedAt" TIMESTAMP(3);
ALTER TABLE "CompetitionProfile" ADD COLUMN "liveOrder" TEXT[] DEFAULT ARRAY[]::TEXT[];
