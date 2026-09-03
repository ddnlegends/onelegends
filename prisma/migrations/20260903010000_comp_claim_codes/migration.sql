-- AlterTable
ALTER TABLE "CompetitionProfile" DROP CONSTRAINT "CompetitionProfile_userId_fkey";

ALTER TABLE "CompetitionProfile" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "CompetitionProfile" ADD COLUMN "slug" TEXT;
ALTER TABLE "CompetitionProfile" ADD COLUMN "claimCode" TEXT;
ALTER TABLE "CompetitionProfile" ADD COLUMN "claimedAt" TIMESTAMP(3);

UPDATE "CompetitionProfile"
SET
  "slug" = "id",
  "claimCode" = "id",
  "claimedAt" = CASE WHEN "userId" IS NOT NULL THEN "createdAt" ELSE NULL END
WHERE "slug" IS NULL;

ALTER TABLE "CompetitionProfile" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "CompetitionProfile" ALTER COLUMN "claimCode" SET NOT NULL;

CREATE UNIQUE INDEX "CompetitionProfile_slug_key" ON "CompetitionProfile"("slug");
CREATE UNIQUE INDEX "CompetitionProfile_claimCode_key" ON "CompetitionProfile"("claimCode");

ALTER TABLE "CompetitionProfile" ADD CONSTRAINT "CompetitionProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
