import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { defaultCategories } from "./default-categories";

type CategoryCreateManyClient = {
  category: {
    createMany(args: Prisma.CategoryCreateManyArgs): Promise<Prisma.BatchPayload>;
  };
};

export function buildDefaultCategoriesForUser(userId: string) {
  return defaultCategories.map((category) => ({
    ...category,
    userId,
    isDefault: true
  }));
}

export function ensureDefaultCategoriesForUser(userId: string, client: CategoryCreateManyClient = prisma) {
  return client.category.createMany({
    data: buildDefaultCategoriesForUser(userId),
    skipDuplicates: true
  });
}
