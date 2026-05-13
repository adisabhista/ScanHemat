import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type TransactionPeriod = "month" | "year" | "all" | "custom";

export type TransactionFilters = {
  period?: TransactionPeriod;
  month?: number;
  year?: number;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
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
  const period = filters.period ?? "month";
  const selectedYear = filters.year ?? now.getUTCFullYear();
  const selectedMonth = filters.month ?? now.getUTCMonth() + 1;

  if (period === "all") {
    return {};
  }

  if (period === "year") {
    return getYearRange(selectedYear);
  }

  if (period === "custom") {
    const start = parseInputDate(filters.startDate);
    const end = parseInputDate(filters.endDate);

    return {
      ...(start ? { start } : {}),
      ...(end ? { end: addUtcDays(end, 1) } : {})
    };
  }

  return getMonthRange(selectedYear, selectedMonth);
}

export function getFilterLabel(filters: TransactionFilters = {}, now = new Date()) {
  const period = filters.period ?? "month";
  const selectedYear = filters.year ?? now.getUTCFullYear();
  const selectedMonth = filters.month ?? now.getUTCMonth() + 1;

  if (period === "year") {
    return `Tahun ${selectedYear}`;
  }

  if (period === "all") {
    return "Semua Waktu";
  }

  if (period === "custom") {
    return "Rentang Kustom";
  }

  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric"
  }).format(new Date(Date.UTC(selectedYear, selectedMonth - 1, 1)));
}

export async function getTransactions(userId: string, filters: TransactionFilters = {}) {
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

  return prisma.transaction.findMany({
    where,
    include: {
      category: true,
      receipt: true,
      items: true
    },
    orderBy: {
      transactionDate: "desc"
    }
  });
}

export async function getRecentTransactions(userId: string, filters: TransactionFilters = {}, take = 5) {
  const transactions = await getTransactions(userId, filters);

  return transactions.slice(0, take);
}

export async function getTransactionById(userId: string, id: string) {
  return prisma.transaction.findFirst({
    where: { id, userId },
    include: {
      category: true,
      receipt: true,
      items: true
    }
  });
}
