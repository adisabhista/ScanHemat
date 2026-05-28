import { Prisma } from "@prisma/client";

import { normalizeTransactionFilters, type TransactionFilters } from "@/features/transactions/period-filter";
import { prisma } from "@/lib/prisma";

export type { TransactionFilters, TransactionPeriod } from "@/features/transactions/period-filter";

const defaultTransactionPageSize = 50;
const transactionInclude = {
  category: true,
  receipt: true,
  items: true
} satisfies Prisma.TransactionInclude;

const transactionOrderBy = [
  { transactionDate: "desc" },
  { id: "desc" }
] satisfies Prisma.TransactionOrderByWithRelationInput[];

export type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: typeof transactionInclude;
}>;

export type TransactionPagination = {
  take?: number;
  cursor?: string;
  skip?: number;
};

export type PaginatedTransactions = {
  data: TransactionWithRelations[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount?: number;
};

export function getMonthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  return { start, end };
}

export function getYearRange(year: number) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  return { start, end };
}

function parseInputDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function addUtcDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

export function getTransactionDateRange(filters: TransactionFilters = {}, now = new Date()) {
  const normalized = normalizeTransactionFilters(filters, now);

  if (normalized.period === "all") {
    return {};
  }

  if (normalized.period === "year") {
    return getYearRange(normalized.year!);
  }

  if (normalized.period === "custom") {
    const start = parseInputDate(normalized.startDate);
    const end = parseInputDate(normalized.endDate);

    return {
      ...(start ? { start } : {}),
      ...(end ? { end: addUtcDays(end, 1) } : {})
    };
  }

  return getMonthRange(normalized.year!, normalized.month!);
}

export function getFilterLabel(filters: TransactionFilters = {}, now = new Date()) {
  const normalized = normalizeTransactionFilters(filters, now);

  if (normalized.period === "year") {
    return `Tahun ${normalized.year}`;
  }

  if (normalized.period === "all") {
    return "Semua Waktu";
  }

  if (normalized.period === "custom") {
    return "Rentang Kustom";
  }

  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric"
  }).format(new Date(Date.UTC(normalized.year!, normalized.month! - 1, 1)));
}

export function buildTransactionWhere(userId: string, filters: TransactionFilters = {}) {
  const where: Prisma.TransactionWhereInput = {
    userId
  };
  const { start, end } = getTransactionDateRange(filters);

  if (start || end) {
    where.transactionDate = {
      ...(start ? { gte: start } : {}),
      ...(end ? { lt: end } : {})
    };
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.needsReview) {
    where.needsReview = true;
  }

  if (filters.search) {
    where.OR = [
      { merchant: { contains: filters.search, mode: "insensitive" } },
      { notes: { contains: filters.search, mode: "insensitive" } },
      { category: { name: { contains: filters.search, mode: "insensitive" } } }
    ];
  }

  return where;
}

export async function getTransactions(
  userId: string,
  filters: TransactionFilters = {},
  pagination: TransactionPagination = {}
): Promise<PaginatedTransactions> {
  const take = Math.max(1, Math.min(pagination.take ?? defaultTransactionPageSize, 100));
  const where = buildTransactionWhere(userId, filters);
  const [rows, totalCount] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: transactionInclude,
      orderBy: transactionOrderBy,
      take: take + 1,
      ...(pagination.cursor ? { cursor: { id: pagination.cursor }, skip: 1 } : pagination.skip ? { skip: pagination.skip } : {})
    }),
    prisma.transaction.count({ where })
  ]);
  const hasMore = rows.length > take;
  const data = hasMore ? rows.slice(0, take) : rows;

  return {
    data,
    nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
    hasMore,
    totalCount
  };
}

export async function getTransactionsForExport(userId: string, filters: TransactionFilters = {}) {
  return prisma.transaction.findMany({
    where: buildTransactionWhere(userId, filters),
    include: transactionInclude,
    orderBy: transactionOrderBy
  });
}

export async function getRecentTransactions(userId: string, filters: TransactionFilters = {}, take = 5) {
  return prisma.transaction.findMany({
    where: buildTransactionWhere(userId, filters),
    include: transactionInclude,
    orderBy: transactionOrderBy,
    take
  });
}

export async function getTransactionById(userId: string, id: string) {
  return prisma.transaction.findFirst({
    where: { id, userId },
    include: transactionInclude
  });
}

export async function getNeedsReviewSummary(userId: string) {
  const [count, firstTransaction] = await Promise.all([
    prisma.transaction.count({
      where: {
        userId,
        needsReview: true
      }
    }),
    prisma.transaction.findFirst({
      where: {
        userId,
        needsReview: true
      },
      orderBy: transactionOrderBy,
      select: {
        reviewReason: true
      }
    })
  ]);

  return {
    count,
    reason: getFirstReviewReason(firstTransaction?.reviewReason)
  };
}

function getFirstReviewReason(value: Prisma.JsonValue | undefined) {
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : null;
}
