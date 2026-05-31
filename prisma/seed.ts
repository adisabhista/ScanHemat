import { PrismaClient } from "@prisma/client";
import { defaultCategories } from "../src/features/categories/default-categories";

const prisma = new PrismaClient();

async function main() {
  for (const category of defaultCategories) {
    const existing = await prisma.category.findFirst({
      where: {
        userId: null,
        name: category.name,
        isDefault: true
      }
    });

    if (!existing) {
      await prisma.category.create({
        data: {
          ...category,
          isDefault: true
        }
      });
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
