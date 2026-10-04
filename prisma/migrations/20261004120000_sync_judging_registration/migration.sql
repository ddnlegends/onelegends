ALTER TABLE "Application" ADD COLUMN "viewingPosition" INTEGER;

ALTER TABLE "CompetitionProfile" ADD COLUMN "livePosition" INTEGER,
ADD COLUMN "liveUpdatedAt" TIMESTAMP(3);

CREATE TABLE "RegistrationAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegistrationInvite" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationInvite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RegistrationAccess_competitionId_idx" ON "RegistrationAccess"("competitionId");

CREATE UNIQUE INDEX "RegistrationAccess_userId_competitionId_key" ON "RegistrationAccess"("userId", "competitionId");

CREATE INDEX "RegistrationInvite_email_idx" ON "RegistrationInvite"("email");

CREATE UNIQUE INDEX "RegistrationInvite_competitionId_email_key" ON "RegistrationInvite"("competitionId", "email");

CREATE UNIQUE INDEX "Application_competitionId_viewingPosition_key" ON "Application"("competitionId", "viewingPosition");

ALTER TABLE "RegistrationAccess" ADD CONSTRAINT "RegistrationAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RegistrationAccess" ADD CONSTRAINT "RegistrationAccess_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "CompetitionProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RegistrationInvite" ADD CONSTRAINT "RegistrationInvite_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "CompetitionProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
