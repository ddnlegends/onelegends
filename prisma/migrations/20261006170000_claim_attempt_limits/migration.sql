-- Additive: older app versions ignore these fields during a code rollback.
-- A single row per user keeps attempts consistent across serverless instances.
ALTER TABLE "User"
  ADD COLUMN "claimAttemptWindowStart" TIMESTAMPTZ(3),
  ADD COLUMN "claimAttemptCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "User" ADD CONSTRAINT "User_claimAttemptCount_nonnegative"
  CHECK ("claimAttemptCount" >= 0);
