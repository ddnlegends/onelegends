-- CreateTable
CREATE TABLE "TeamPhotoBlob" (
    "teamId" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamPhotoBlob_pkey" PRIMARY KEY ("teamId")
);

-- AddForeignKey
ALTER TABLE "TeamPhotoBlob" ADD CONSTRAINT "TeamPhotoBlob_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "TeamProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
