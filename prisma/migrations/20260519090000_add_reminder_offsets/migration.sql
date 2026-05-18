-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN "reminderOffsets" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
