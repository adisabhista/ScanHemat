ALTER TABLE "Reminder" ALTER COLUMN "amount" TYPE DECIMAL(14,2) USING "amount"::DECIMAL(14,2);

ALTER TABLE "Receipt" ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Receipt" ADD COLUMN "reviewReasons" JSONB;
ALTER TABLE "Receipt" ADD COLUMN "reviewedAt" TIMESTAMP(3);

ALTER TABLE "Transaction" ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Transaction" ADD COLUMN "reviewReasons" JSONB;
ALTER TABLE "Transaction" ADD COLUMN "reviewedAt" TIMESTAMP(3);

CREATE INDEX "Receipt_userId_needsReview_idx" ON "Receipt"("userId", "needsReview");
CREATE INDEX "Transaction_userId_needsReview_idx" ON "Transaction"("userId", "needsReview");
