import { prisma } from "@/lib/prisma";

export async function getAvailableCategories(userId: string) {
  return prisma.category.findMany({
    where: {
      OR: [{ userId }, { userId: null, isDefault: true }]
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }]
  });
}

export async function getCategorySummaries(userId: string, date = new Date()) {
  const categories = await getAvailableCategories(userId);
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      transactionDate: {
        gte: start,
        lt: end
      }
    },
    select: {
      categoryId: true,
      totalAmount: true
    }
  });
  const summaries = transactions.reduce<Record<string, { transactionCount: number; monthlyAmount: number }>>((accumulator, transaction) => {
    const current = accumulator[transaction.categoryId] ?? { transactionCount: 0, monthlyAmount: 0 };
    accumulator[transaction.categoryId] = {
      transactionCount: current.transactionCount + 1,
      monthlyAmount: current.monthlyAmount + Number(transaction.totalAmount)
    };

    return accumulator;
  }, {});

  return categories.map((category) => ({
    ...category,
    transactionCount: summaries[category.id]?.transactionCount ?? 0,
    monthlyAmount: summaries[category.id]?.monthlyAmount ?? 0
  }));
}

export async function ensureCategoryAccess(userId: string, categoryId: string) {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      OR: [{ userId }, { userId: null, isDefault: true }]
    }
  });

  if (!category) {
    throw new Error("CATEGORY_NOT_FOUND");
  }

  return category;
}
