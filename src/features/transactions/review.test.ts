import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { prisma } from "@/lib/prisma";

import { buildTransactionReviewData, markTransactionReviewedForUser } from "./review";

test("transaction review data defaults to not needing review", () => {
  assert.deepEqual(buildTransactionReviewData(null), {
    needsReview: false,
    reviewReason: undefined,
    reviewedAt: undefined
  });
});

test("low-confidence receipt review data marks transaction as needs review", () => {
  assert.deepEqual(
    buildTransactionReviewData({
      needsReview: true,
      reviewReasons: ["Kualitas OCR rendah."],
      reviewedAt: null
    }),
    {
      needsReview: true,
      reviewReason: ["Kualitas OCR rendah."],
      reviewedAt: undefined
    }
  );
});

test("markTransactionReviewedForUser clears needsReview for owned transaction", async (t) => {
  let findFirstArgs: unknown;
  let transactionUpdateArgs: unknown;
  let receiptUpdateArgs: unknown;

  mockReviewDelegates(t, {
    findFirst: async (args: unknown) => {
      findFirstArgs = args;
      return {
        id: "tx-1",
        receiptId: "receipt-1"
      };
    },
    transactionUpdateMany: async (args: unknown) => {
      transactionUpdateArgs = args;
      return { count: 1 };
    },
    receiptUpdateMany: async (args: unknown) => {
      receiptUpdateArgs = args;
      return { count: 1 };
    }
  });

  const result = await markTransactionReviewedForUser("user-1", "tx-1");

  assert.deepEqual(findFirstArgs, {
    where: {
      id: "tx-1",
      userId: "user-1"
    },
    select: {
      id: true,
      receiptId: true
    }
  });
  assert.equal(result?.id, "tx-1");
  assert.deepEqual((transactionUpdateArgs as { where: unknown }).where, {
    id: "tx-1",
    userId: "user-1"
  });
  assert.equal((transactionUpdateArgs as { data: { needsReview: boolean } }).data.needsReview, false);
  assert.ok((transactionUpdateArgs as { data: { reviewedAt: Date } }).data.reviewedAt instanceof Date);
  assert.deepEqual((receiptUpdateArgs as { where: unknown }).where, {
    id: "receipt-1",
    userId: "user-1"
  });
  assert.equal((receiptUpdateArgs as { data: { needsReview: boolean } }).data.needsReview, false);
});

function mockReviewDelegates(
  t: TestContext,
  methods: {
    findFirst: (args?: unknown) => Promise<unknown>;
    transactionUpdateMany: (args?: unknown) => Promise<unknown>;
    receiptUpdateMany: (args?: unknown) => Promise<unknown>;
  }
) {
  const transactionDelegate = prisma.transaction as unknown as {
    findFirst: (args?: unknown) => Promise<unknown>;
    updateMany: (args?: unknown) => Promise<unknown>;
  };
  const receiptDelegate = prisma.receipt as unknown as {
    updateMany: (args?: unknown) => Promise<unknown>;
  };
  const client = prisma as unknown as {
    $transaction: (operations: unknown[]) => Promise<unknown[]>;
  };

  const originalFindFirst = transactionDelegate.findFirst;
  const originalTransactionUpdateMany = transactionDelegate.updateMany;
  const originalReceiptUpdateMany = receiptDelegate.updateMany;
  const originalTransaction = client.$transaction;

  transactionDelegate.findFirst = methods.findFirst;
  transactionDelegate.updateMany = methods.transactionUpdateMany;
  receiptDelegate.updateMany = methods.receiptUpdateMany;
  client.$transaction = async (operations) => Promise.all(operations);

  t.after(() => {
    transactionDelegate.findFirst = originalFindFirst;
    transactionDelegate.updateMany = originalTransactionUpdateMany;
    receiptDelegate.updateMany = originalReceiptUpdateMany;
    client.$transaction = originalTransaction;
  });
}
