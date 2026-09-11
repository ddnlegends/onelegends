-- CreateEnum
CREATE TYPE "TeamMembershipStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "platformAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TeamProfile" ADD COLUMN "slug" TEXT;

UPDATE "TeamProfile" SET "slug" = "id" WHERE "slug" IS NULL;

ALTER TABLE "TeamProfile" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "TeamProfile_slug_key" ON "TeamProfile"("slug");

-- CreateTable
CREATE TABLE "TeamMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" "TeamMembershipStatus" NOT NULL DEFAULT 'PENDING',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamMembership_userId_teamId_key" ON "TeamMembership"("userId", "teamId");
CREATE INDEX "TeamMembership_teamId_status_idx" ON "TeamMembership"("teamId", "status");

ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "TeamProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "TeamInvite" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamInvite_teamId_email_key" ON "TeamInvite"("teamId", "email");
CREATE INDEX "TeamInvite_email_idx" ON "TeamInvite"("email");

ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "TeamProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Move existing 1:1 team owners onto memberships
INSERT INTO "TeamMembership" ("id", "userId", "teamId", "status", "isAdmin", "requestedAt", "decidedAt", "createdAt", "updatedAt")
SELECT
    "userId" || '-owner',
    "userId",
    "id",
    'APPROVED'::"TeamMembershipStatus",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "TeamProfile"
WHERE "userId" IS NOT NULL;

-- DropTable owner column
ALTER TABLE "TeamProfile" DROP CONSTRAINT "TeamProfile_userId_fkey";
DROP INDEX "TeamProfile_userId_key";
ALTER TABLE "TeamProfile" DROP COLUMN "userId";
