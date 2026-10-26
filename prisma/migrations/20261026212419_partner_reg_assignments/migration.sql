-- CreateTable
CREATE TABLE "CompetitionRegAssignment" (
    "competitionId" TEXT NOT NULL,
    "email" VARCHAR(320),
    "contactName" VARCHAR(120),
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByEmail" VARCHAR(320) NOT NULL,
    "avReviewedAt" TIMESTAMPTZ(3),
    "avReviewFingerprint" VARCHAR(64),
    "lastContactAt" TIMESTAMPTZ(3),
    "followUpNote" VARCHAR(3000) NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CompetitionRegAssignment_pkey" PRIMARY KEY ("competitionId"),
    CONSTRAINT "CompetitionRegAssignment_contact_check" CHECK (("email" IS NULL AND "contactName" IS NULL) OR ("email" IS NOT NULL AND "contactName" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "CompetitionRegAssignmentAudit" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "competitionName" TEXT NOT NULL,
    "oldEmail" TEXT,
    "newEmail" TEXT,
    "changedByEmail" TEXT NOT NULL,
    "changedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitionRegAssignmentAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompetitionRegAssignment_email_idx" ON "CompetitionRegAssignment"("email");

-- CreateIndex
CREATE INDEX "CompetitionRegAssignmentAudit_competitionId_changedAt_idx" ON "CompetitionRegAssignmentAudit"("competitionId", "changedAt");

-- AddForeignKey
ALTER TABLE "CompetitionRegAssignment" ADD CONSTRAINT "CompetitionRegAssignment_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "CompetitionProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
