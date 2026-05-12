import { prisma } from "@/lib/prisma";

export async function getBudgets(userId: string, year?: number, month?: number) {
  return prisma.budget.findMany({
    where: {
      userId,
      ...(year ? { year } : {}),
      ...(month ? { month } : {})
    },
    include: {
      category: true
    },
    orderBy: [{ year: "desc" }, { month: "desc" }, { category: { name: "asc" } }]
  });
}
