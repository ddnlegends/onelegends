-- AlterTable TeamProfile
ALTER TABLE "TeamProfile" ADD COLUMN "claimCode" TEXT;
ALTER TABLE "TeamProfile" ADD COLUMN "claimedAt" TIMESTAMP(3);

UPDATE "TeamProfile" SET "claimCode" = 'TEAM-' || UPPER(SUBSTRING("id" FROM 1 FOR 6)) WHERE "claimCode" IS NULL;

ALTER TABLE "TeamProfile" ALTER COLUMN "claimCode" SET NOT NULL;
CREATE UNIQUE INDEX "TeamProfile_claimCode_key" ON "TeamProfile"("claimCode");

-- AlterTable TeamMembership
ALTER TABLE "TeamMembership" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable CompetitionMembership
CREATE TABLE "CompetitionMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "status" "TeamMembershipStatus" NOT NULL DEFAULT 'PENDING',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompetitionMembership_userId_competitionId_key" ON "CompetitionMembership"("userId", "competitionId");
CREATE INDEX "CompetitionMembership_competitionId_status_idx" ON "CompetitionMembership"("competitionId", "status");

ALTER TABLE "CompetitionMembership" ADD CONSTRAINT "CompetitionMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetitionMembership" ADD CONSTRAINT "CompetitionMembership_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "CompetitionProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CompetitionMembership" ("id", "userId", "competitionId", "status", "isAdmin", "isPrimary", "requestedAt", "decidedAt", "createdAt", "updatedAt")
SELECT
    "userId" || '-comp-owner',
    "userId",
    "id",
    'APPROVED'::"TeamMembershipStatus",
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "CompetitionProfile"
WHERE "userId" IS NOT NULL;

-- CreateTable CompInvite
CREATE TABLE "CompInvite" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompInvite_competitionId_email_key" ON "CompInvite"("competitionId", "email");
CREATE INDEX "CompInvite_email_idx" ON "CompInvite"("email");

ALTER TABLE "CompInvite" ADD CONSTRAINT "CompInvite_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "CompetitionProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable JudgeInvite
CREATE TABLE "JudgeInvite" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JudgeInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JudgeInvite_competitionId_email_key" ON "JudgeInvite"("competitionId", "email");
CREATE INDEX "JudgeInvite_email_idx" ON "JudgeInvite"("email");

ALTER TABLE "JudgeInvite" ADD CONSTRAINT "JudgeInvite_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "CompetitionProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
