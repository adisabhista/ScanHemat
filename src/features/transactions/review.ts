import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ReceiptReviewData = {
  needsReview: boolean;
  reviewReasons: Prisma.JsonValue;
  reviewedAt: Date | null;
} | null;

export function buildTransactionReviewData(receiptReview: ReceiptReviewData) {
  return {
    needsReview: receiptReview?.needsReview ?? false,
    reviewReason: receiptReview?.reviewReasons ?? undefined,
    reviewedAt: receiptReview?.reviewedAt ?? undefined
  };
}

export async function markTransactionReviewedForUser(userId: string, transactionId: string) {
  const existing = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      userId
    },
    select: {
      id: true,
      receiptId: true
    }
  });

  if (!existing) {
    return null;
  }

  const reviewedAt = new Date();
  await prisma.$transaction([
    prisma.transaction.updateMany({
      where: {
        id: existing.id,
        userId
      },
      data: {
        needsReview: false,
        reviewedAt
      }
    }),
    ...(existing.receiptId
      ? [
          prisma.receipt.updateMany({
            where: {
              id: existing.receiptId,
              userId
            },
            data: {
              needsReview: false,
              reviewedAt
            }
          })
        ]
      : [])
  ]);

  return {
    id: existing.id,
    reviewedAt
  };
}
