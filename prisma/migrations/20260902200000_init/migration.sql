-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('TEAM', 'COMP');

-- CreateEnum
CREATE TYPE "public"."ApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'WAITLISTED', 'DECLINED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TeamProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL DEFAULT '',
    "blurb" TEXT NOT NULL DEFAULT '',
    "wikiUrl" TEXT NOT NULL DEFAULT '',
    "avDriveUrl" TEXT NOT NULL DEFAULT '',
    "captains" TEXT NOT NULL DEFAULT '',
    "yearsEstablished" INTEGER,
    "rosterSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Dancer" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dietaryRestrictions" TEXT NOT NULL DEFAULT '',
    "tshirtSize" TEXT NOT NULL DEFAULT '',
    "inAV" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Dancer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompetitionProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "acceptingApps" BOOLEAN NOT NULL DEFAULT true,
    "dates" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "venue" TEXT NOT NULL DEFAULT '',
    "stageSize" TEXT NOT NULL DEFAULT '',
    "productionNotes" TEXT NOT NULL DEFAULT '',
    "lighting" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "googleSheetId" TEXT NOT NULL DEFAULT '',
    "googleSheetUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Application" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "status" "public"."ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TeamProfile_userId_key" ON "public"."TeamProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionProfile_userId_key" ON "public"."CompetitionProfile"("userId");

-- CreateIndex
CREATE INDEX "Application_competitionId_idx" ON "public"."Application"("competitionId");

-- CreateIndex
CREATE INDEX "Application_teamId_idx" ON "public"."Application"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_teamId_competitionId_key" ON "public"."Application"("teamId", "competitionId");

-- AddForeignKey
ALTER TABLE "public"."TeamProfile" ADD CONSTRAINT "TeamProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dancer" ADD CONSTRAINT "Dancer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."TeamProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompetitionProfile" ADD CONSTRAINT "CompetitionProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Application" ADD CONSTRAINT "Application_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."TeamProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Application" ADD CONSTRAINT "Application_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "public"."CompetitionProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
