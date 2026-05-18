-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('SUBSCRIPTION', 'BILL', 'VEHICLE_TAX', 'STNK', 'SIM', 'WARRANTY', 'LICENSE', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "RepeatType" AS ENUM ('NONE', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('ACTIVE', 'DONE', 'DISMISSED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL,
    "amount" INTEGER,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "repeatType" "RepeatType" NOT NULL DEFAULT 'NONE',
    "status" "ReminderStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "relatedMerchant" TEXT,
    "relatedDocumentName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reminder_userId_dueDate_idx" ON "Reminder"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "Reminder_userId_status_idx" ON "Reminder"("userId", "status");

-- CreateIndex
CREATE INDEX "Reminder_userId_type_idx" ON "Reminder"("userId", "type");

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
