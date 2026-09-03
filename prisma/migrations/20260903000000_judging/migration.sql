-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'JUDGE';

-- CreateEnum
CREATE TYPE "JudgeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- AlterTable
ALTER TABLE "CompetitionProfile" ADD COLUMN     "applicationDeadline" TIMESTAMP(3),
ADD COLUMN     "requiredJudgeCount" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "resultsReleasedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "JudgeProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JudgeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgeAssignment" (
    "id" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "status" "JudgeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JudgeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgeViewingSlot" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "JudgeViewingSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgeScore" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "choreography" INTEGER NOT NULL,
    "formations" INTEGER NOT NULL,
    "technique" INTEGER NOT NULL,
    "syncCleanliness" INTEGER NOT NULL,
    "overallImpression" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JudgeScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JudgeProfile_userId_key" ON "JudgeProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "JudgeAssignment_judgeId_competitionId_key" ON "JudgeAssignment"("judgeId", "competitionId");

-- CreateIndex
CREATE INDEX "JudgeAssignment_competitionId_status_idx" ON "JudgeAssignment"("competitionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "JudgeViewingSlot_assignmentId_position_key" ON "JudgeViewingSlot"("assignmentId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "JudgeViewingSlot_assignmentId_applicationId_key" ON "JudgeViewingSlot"("assignmentId", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "JudgeScore_slotId_key" ON "JudgeScore"("slotId");

-- AddForeignKey
ALTER TABLE "JudgeProfile" ADD CONSTRAINT "JudgeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeAssignment" ADD CONSTRAINT "JudgeAssignment_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "JudgeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeAssignment" ADD CONSTRAINT "JudgeAssignment_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "CompetitionProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeViewingSlot" ADD CONSTRAINT "JudgeViewingSlot_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "JudgeAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeViewingSlot" ADD CONSTRAINT "JudgeViewingSlot_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeScore" ADD CONSTRAINT "JudgeScore_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "JudgeAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeScore" ADD CONSTRAINT "JudgeScore_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "JudgeViewingSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
