ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE TABLE "PlatformAdminInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAdminInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAdminInvite_email_key" ON "PlatformAdminInvite"("email");
