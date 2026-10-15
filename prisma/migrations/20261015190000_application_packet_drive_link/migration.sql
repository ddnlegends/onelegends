-- Additive rollout: keep existing PDF rows available until the link replacement is live.
ALTER TABLE "CompetitionProfile"
  ADD COLUMN "applicationPacketDriveUrl" TEXT,
  ADD COLUMN "applicationPacketLegacyHidden" BOOLEAN NOT NULL DEFAULT false;
