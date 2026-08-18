-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SCHEDULED', 'PROCESSING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sender" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "smtpHost" TEXT NOT NULL,
    "smtpPort" INTEGER NOT NULL,
    "smtpUser" TEXT NOT NULL,
    "smtpPassword" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Email" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "bullJobId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Sender_userId_idx" ON "Sender"("userId");

-- CreateIndex
CREATE INDEX "Sender_email_idx" ON "Sender"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Email_idempotencyKey_key" ON "Email"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Email_userId_idx" ON "Email"("userId");

-- CreateIndex
CREATE INDEX "Email_senderId_idx" ON "Email"("senderId");

-- CreateIndex
CREATE INDEX "Email_status_idx" ON "Email"("status");

-- CreateIndex
CREATE INDEX "Email_scheduledAt_idx" ON "Email"("scheduledAt");

-- CreateIndex
CREATE INDEX "Email_bullJobId_idx" ON "Email"("bullJobId");

-- CreateIndex
CREATE INDEX "Email_status_scheduledAt_idx" ON "Email"("status", "scheduledAt");

-- AddForeignKey
ALTER TABLE "Sender" ADD CONSTRAINT "Sender_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Sender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
