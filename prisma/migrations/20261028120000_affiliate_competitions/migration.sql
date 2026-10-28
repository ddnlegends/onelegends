ALTER TABLE "CompetitionProfile" ADD COLUMN "isAffiliate" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CompetitionProfile"
  ADD CONSTRAINT "CompetitionProfile_partner_affiliate_exclusive"
  CHECK (NOT ("isPartner" AND "isAffiliate"));

-- Rang de Storrs uses partner-style judging without changing its recorded payment.
UPDATE "CompetitionProfile"
SET "isPartner" = false, "isAffiliate" = true
WHERE id = 'cmvfsl9d00002jp08ucaqu9yv';
