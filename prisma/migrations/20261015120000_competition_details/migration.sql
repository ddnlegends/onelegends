ALTER TABLE "CompetitionProfile"
  ADD COLUMN "eventStartDate" DATE,
  ADD COLUMN "eventEndDate" DATE,
  ADD COLUMN "venueAddress" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "regularApplicationFeeCents" INTEGER,
  ADD COLUMN "lateApplicationFeeCents" INTEGER,
  ADD COLUMN "paymentInstructions" TEXT NOT NULL DEFAULT '',
  ADD CONSTRAINT "CompetitionProfile_event_dates_check" CHECK (
    ("eventStartDate" IS NULL AND "eventEndDate" IS NULL) OR
    ("eventStartDate" IS NOT NULL AND "eventEndDate" IS NOT NULL AND "eventEndDate" >= "eventStartDate")
  ),
  ADD CONSTRAINT "CompetitionProfile_application_fees_check" CHECK (
    ("regularApplicationFeeCents" IS NULL OR "regularApplicationFeeCents" >= 0) AND
    ("lateApplicationFeeCents" IS NULL OR "lateApplicationFeeCents" >= 0)
  );

CREATE TABLE "CompetitionPacketBlob" (
  "competitionId" TEXT NOT NULL PRIMARY KEY,
  "filename" TEXT NOT NULL,
  "bytes" BYTEA NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetitionPacketBlob_competitionId_fkey" FOREIGN KEY ("competitionId")
    REFERENCES "CompetitionProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Preserve legacy free-text dates, lighting guidelines and descriptions as-is.
-- Structured dates are populated when a host chooses dates in the new form.
