import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export function getMonthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  return { start, end };
}

export async function getTransactions(
  userId: string,
  filters: {
    month?: number;
    year?: number;
    categoryId?: string;
  } = {}
) {
  const where: Prisma.TransactionWhereInput = {
    userId
  };

  if (filters.month && filters.year) {
    const { start, end } = getMonthRange(filters.year, filters.month);
    where.transactionDate = {
      gte: start,
      lt: end
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
