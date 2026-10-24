CREATE TYPE "CompPaymentReviewStatus" AS ENUM ('UNREVIEWED', 'PAID', 'UNPAID', 'WAIVED', 'LEGACY_INCLUDED');

ALTER TABLE "CompetitionProfile"
  ADD COLUMN "resultsValidatedAt" TIMESTAMP(3),
  ADD COLUMN "resultsValidatedByEmail" TEXT,
  ADD COLUMN "compPaymentsVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "compPaymentsVerifiedByEmail" TEXT;

ALTER TABLE "Application"
  ADD COLUMN "compPaymentReviewStatus" "CompPaymentReviewStatus" NOT NULL DEFAULT 'UNREVIEWED';

UPDATE "Application" SET "compPaymentReviewStatus" = 'PAID'
WHERE "compPaymentReceivedAt" IS NOT NULL;

-- A previously frozen viewing order remains eligible without inventing a host-payment receipt or waiver.
UPDATE "Application" SET "compPaymentReviewStatus" = 'LEGACY_INCLUDED'
WHERE "viewingPosition" IS NOT NULL AND "compPaymentReviewStatus" = 'UNREVIEWED';

-- Previously finalized Partner results have already passed the old combined validation/release step.
UPDATE "CompetitionProfile"
SET "resultsValidatedAt" = "resultsReleasedAt", "resultsValidatedByEmail" = "resultsFinalizedByEmail"
WHERE "isPartner" = true AND "resultsReleasedAt" IS NOT NULL;

-- Existing Non Partner panels that were already fully submitted now follow the automatic release path.
WITH eligible AS (
  SELECT a."id", a."competitionId"
  FROM "Application" a
  JOIN "TeamProfile" t ON t."id" = a."teamId"
  WHERE a."removedAt" IS NULL
    AND t."applyBlocked" = false
    AND t."registrationPaidAt" IS NOT NULL
    AND (a."viewingPosition" IS NOT NULL OR a."compPaymentReviewStatus" IN ('PAID', 'WAIVED'))
), ready AS (
  SELECT c."id"
  FROM "CompetitionProfile" c
  WHERE c."isPartner" = false AND c."resultsReleasedAt" IS NULL
    AND EXISTS (SELECT 1 FROM eligible e WHERE e."competitionId" = c."id")
    AND EXISTS (SELECT 1 FROM "JudgeAssignment" j WHERE j."competitionId" = c."id" AND j."status" = 'APPROVED')
    AND NOT EXISTS (SELECT 1 FROM "JudgeInvite" i WHERE i."competitionId" = c."id")
    AND NOT EXISTS (SELECT 1 FROM "JudgeAssignment" j WHERE j."competitionId" = c."id" AND j."status" = 'PENDING')
    AND NOT EXISTS (
      SELECT 1 FROM "JudgeAssignment" j
      WHERE j."competitionId" = c."id" AND j."status" = 'APPROVED'
        AND (
          j."submittedAt" IS NULL
          OR EXISTS (
            SELECT 1 FROM eligible e
            LEFT JOIN "JudgeViewingSlot" s ON s."assignmentId" = j."id" AND s."applicationId" = e."id"
            LEFT JOIN "JudgeScore" score ON score."slotId" = s."id"
            WHERE e."competitionId" = c."id"
              AND (s."id" IS NULL OR score."id" IS NULL OR score."choreography" IS NULL
                OR score."formations" IS NULL OR score."technique" IS NULL
                OR score."syncCleanliness" IS NULL OR score."overallImpression" IS NULL)
          )
          OR EXISTS (
            SELECT 1 FROM "JudgeViewingSlot" s
            WHERE s."assignmentId" = j."id"
              AND NOT EXISTS (SELECT 1 FROM eligible e WHERE e."id" = s."applicationId" AND e."competitionId" = c."id")
          )
        )
    )
)
UPDATE "CompetitionProfile" c
SET "resultsReleasedAt" = CURRENT_TIMESTAMP,
    "judgingOpen" = false,
    "livePosition" = NULL,
    "liveUpdatedAt" = NULL
FROM ready WHERE ready."id" = c."id";

CREATE TABLE "CompetitionDeletionAudit" (
  "id" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "competitionName" TEXT NOT NULL,
  "actorEmail" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "applicationCount" INTEGER NOT NULL,
  "judgeCount" INTEGER NOT NULL,
  "hadReleasedResults" BOOLEAN NOT NULL,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetitionDeletionAudit_pkey" PRIMARY KEY ("id")
);
