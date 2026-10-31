CREATE TYPE "TeamOfferResponse" AS ENUM ('NONE', 'CONFIRMED', 'DECLINED', 'CAP_CLOSED');
CREATE TYPE "OfferEventType" AS ENUM ('OFFER_PUBLISHED', 'OFFER_CONFIRMED', 'OFFER_DECLINED', 'CAP_CLOSED', 'WAITLIST_PROMOTED', 'OFFER_REOPENED');

ALTER TABLE "Application"
  ADD COLUMN "teamOfferResponse" "TeamOfferResponse" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "teamOfferRespondedAt" TIMESTAMP(3);

CREATE TABLE "ApplicationOfferEvent" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "type" "OfferEventType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationOfferEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApplicationOfferEvent_applicationId_createdAt_idx" ON "ApplicationOfferEvent"("applicationId", "createdAt");
ALTER TABLE "ApplicationOfferEvent" ADD CONSTRAINT "ApplicationOfferEvent_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
