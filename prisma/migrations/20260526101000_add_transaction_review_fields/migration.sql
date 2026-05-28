ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "needsReview" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Transaction'
      AND column_name = 'reviewReasons'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Transaction'
      AND column_name = 'reviewReason'
  ) THEN
    ALTER TABLE "Transaction" RENAME COLUMN "reviewReasons" TO "reviewReason";
  END IF;
END $$;

ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "reviewReason" JSONB;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Transaction_userId_needsReview_idx" ON "Transaction"("userId", "needsReview");
