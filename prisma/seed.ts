import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const defaultCategories = [
  { name: "Makanan", color: "#10b981" },
  { name: "Transportasi", color: "#3b82f6" },
  { name: "Kebutuhan Rumah", color: "#f59e0b" },
  { name: "Kesehatan", color: "#ef4444" },
  { name: "Elektronik", color: "#8b5cf6" },
  { name: "Hiburan", color: "#ec4899" },
  { name: "Pendidikan", color: "#14b8a6" },
  { name: "Lainnya", color: "#64748b" }
];

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
