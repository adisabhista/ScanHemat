import { prisma } from "@/lib/prisma";
import { ensureDefaultCategoriesForUser } from "./service";

export async function getAvailableCategories(userId: string) {
  await ensureDefaultCategoriesForUser(userId);

  const categories = await prisma.category.findMany({
    where: {
      OR: [{ userId }, { userId: null, isDefault: true }]
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }]
  });

  return deduplicateAvailableCategories(categories, userId);
}

export function deduplicateAvailableCategories<T extends { userId: string | null; name: string; isDefault: boolean }>(
  categories: T[],
  userId: string
) {
  const categoriesByName = new Map<string, T>();

  for (const category of categories) {
    const key = category.name.trim().toLocaleLowerCase("id-ID");
    const current = categoriesByName.get(key);

    if (!current || (current.userId !== userId && category.userId === userId)) {
      categoriesByName.set(key, category);
    }
  }

  return [...categoriesByName.values()].sort(
    (left, right) => Number(right.isDefault) - Number(left.isDefault) || left.name.localeCompare(right.name, "id-ID")
  );
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
