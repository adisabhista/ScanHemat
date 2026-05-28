import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { prisma } from "@/lib/prisma";

import { buildTransactionWhere, getNeedsReviewSummary, getRecentTransactions, getTransactionDateRange, getTransactions } from "./queries";

const now = new Date(Date.UTC(2026, 4, 13));

test("all-time query does not require date values", () => {
  assert.deepEqual(
    getTransactionDateRange({ period: "all", month: 2, year: 2026, startDate: "2026-01-01", endDate: "2026-01-31" }, now),
    {}
  );
});

test("yearly query ignores month value", () => {
  const range = getTransactionDateRange({ period: "year", month: 5, year: 2026 }, now);

  assert.deepEqual(range, {
    start: new Date(Date.UTC(2026, 0, 1)),
    end: new Date(Date.UTC(2027, 0, 1))
  });
});

test("builds user-isolated transaction where clause with category and period filters", () => {
  const where = buildTransactionWhere("user-1", { period: "month", year: 2026, month: 5, categoryId: "food" });

  assert.equal(where.userId, "user-1");
  assert.equal(where.categoryId, "food");
  assert.deepEqual(where.transactionDate, {
    gte: new Date(Date.UTC(2026, 4, 1)),
    lt: new Date(Date.UTC(2026, 5, 1))
  });
});

test("builds transaction search filter with user isolation", () => {
  const where = buildTransactionWhere("user-1", { period: "all", search: "kopi" });

  assert.equal(where.userId, "user-1");
  assert.ok(Array.isArray(where.OR));
});

test("getTransactions returns limited results with hasMore and nextCursor", async (t) => {
  mockTransactionDelegate(t, {
    findMany: async () =>
    Array.from({ length: 3 }, (_, index) => ({
      id: `tx-${index + 1}`
    })),
    count: async () => 3
  });

  const result = await getTransactions("user-1", { period: "all" }, { take: 2 });

  assert.equal(result.data.length, 2);
  assert.equal(result.hasMore, true);
  assert.equal(result.nextCursor, "tx-2");
  assert.equal(result.totalCount, 3);
});

test("getTransactions passes category filter and pagination to Prisma", async (t) => {
  let findManyArgs: unknown;

  mockTransactionDelegate(t, {
    findMany: async (args: unknown) => {
      findManyArgs = args;
      return [];
    },
    count: async () => 0
  });

  await getTransactions("user-1", { period: "all", categoryId: "cat-1" }, { take: 50 });

  assert.equal((findManyArgs as { where: { userId: string; categoryId: string }; take: number }).where.userId, "user-1");
  assert.equal((findManyArgs as { where: { categoryId: string }; take: number }).where.categoryId, "cat-1");
  assert.equal((findManyArgs as { take: number }).take, 51);
});

test("getTransactions respects period filter in Prisma where", async (t) => {
  let countArgs: unknown;

  mockTransactionDelegate(t, {
    findMany: async () => [],
    count: async (args: unknown) => {
      countArgs = args;
      return 0;
    }
  });

  await getTransactions("user-1", { period: "year", year: 2026 }, { take: 50 });

  assert.deepEqual(countArgs, {
    where: {
      userId: "user-1",
      transactionDate: {
        gte: new Date(Date.UTC(2026, 0, 1)),
        lt: new Date(Date.UTC(2027, 0, 1))
      }
    }
  });
});

test("getRecentTransactions only requests the needed records", async (t) => {
  let findManyArgs: unknown;

  mockTransactionDelegate(t, {
    findMany: async (args: unknown) => {
      findManyArgs = args;
      return [];
    }
  });

  await getRecentTransactions("user-1");

  assert.equal((findManyArgs as { where: { userId: string }; take: number }).where.userId, "user-1");
  assert.equal((findManyArgs as { take: number }).take, 5);
});

test("getNeedsReviewSummary counts only the current user's review transactions", async (t) => {
  let countArgs: unknown;
  let findFirstArgs: unknown;

  mockTransactionDelegate(t, {
    count: async (args: unknown) => {
      countArgs = args;
      return 1;
    },
    findFirst: async (args: unknown) => {
      findFirstArgs = args;
      return {
        reviewReason: ["Kualitas OCR rendah."]
      };
    }
  });

  const summary = await getNeedsReviewSummary("user-1");

  assert.deepEqual(countArgs, {
    where: {
      userId: "user-1",
      needsReview: true
    }
  });
  assert.deepEqual((findFirstArgs as { where: unknown }).where, {
    userId: "user-1",
    needsReview: true
  });
  assert.equal(summary.count, 1);
  assert.equal(summary.reason, "Kualitas OCR rendah.");
});

function mockTransactionDelegate(
  t: TestContext,
  methods: {
    findMany?: (args?: unknown) => Promise<unknown[]>;
    findFirst?: (args?: unknown) => Promise<unknown>;
    count?: (args?: unknown) => Promise<number>;
  }
) {
  const delegate = prisma.transaction as unknown as {
    findMany: (args?: unknown) => Promise<unknown[]>;
    findFirst: (args?: unknown) => Promise<unknown>;
    count: (args?: unknown) => Promise<number>;
  };
  const originalFindMany = delegate.findMany;
  const originalFindFirst = delegate.findFirst;
  const originalCount = delegate.count;

  if (methods.findMany) {
    delegate.findMany = methods.findMany;
  }

  if (methods.count) {
    delegate.count = methods.count;
  }

  if (methods.findFirst) {
    delegate.findFirst = methods.findFirst;
  }

  t.after(() => {
    delegate.findMany = originalFindMany;
    delegate.findFirst = originalFindFirst;
    delegate.count = originalCount;
  });
}
