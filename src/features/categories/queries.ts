import { prisma } from "@/lib/prisma";

export async function getAvailableCategories(userId: string) {
  return prisma.category.findMany({
    where: {
      OR: [{ userId }, { userId: null, isDefault: true }]
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }]
  });
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
