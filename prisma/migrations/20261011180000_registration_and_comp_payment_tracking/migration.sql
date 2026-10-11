ALTER TABLE "TeamProfile"
  ADD COLUMN "registrationFeeCents" INTEGER NOT NULL DEFAULT 2500,
  ADD COLUMN "registrationPaidAt" TIMESTAMP(3),
  ADD COLUMN "registrationPaidByEmail" TEXT;

ALTER TABLE "CompetitionProfile"
  ADD COLUMN "registrationFeeCents" INTEGER NOT NULL DEFAULT 2500,
  ADD COLUMN "registrationPaidAt" TIMESTAMP(3),
  ADD COLUMN "registrationPaidByEmail" TEXT;

UPDATE "CompetitionProfile" SET "registrationFeeCents" = 4000 WHERE "isPartner" = false;

ALTER TABLE "Application"
  ADD COLUMN "removedAt" TIMESTAMP(3),
  ADD COLUMN "removedByEmail" TEXT,
  ADD COLUMN "removalReason" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "compPaymentReceivedAt" TIMESTAMP(3),
  ADD COLUMN "compPaymentRecordedByEmail" TEXT;
