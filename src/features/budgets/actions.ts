"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ensureCategoryAccess } from "@/features/categories/queries";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { budgetSchema } from "@/lib/validation/budget";

export async function upsertBudgetAction(formData: FormData) {
  const userId = await requireUserId();
  const parsed = budgetSchema.safeParse({
    categoryId: formData.get("categoryId"),
    month: formData.get("month"),
    year: formData.get("year"),
    amount: formData.get("amount")
  });

  if (!parsed.success) {
    redirect(`/budgets?error=${encodeURIComponent(parsed.error.errors[0]?.message ?? "Gagal menyimpan anggaran.")}`);
  }

  await ensureCategoryAccess(userId, parsed.data.categoryId);

  await prisma.budget.upsert({
    where: {
      userId_categoryId_month_year: {
        userId,
        categoryId: parsed.data.categoryId,
        month: parsed.data.month,
        year: parsed.data.year
      }
    },
    update: {
      amount: new Prisma.Decimal(parsed.data.amount)
    },
    create: {
      userId,
      categoryId: parsed.data.categoryId,
      month: parsed.data.month,
      year: parsed.data.year,
      amount: new Prisma.Decimal(parsed.data.amount)
    }
  });

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  redirect("/budgets");
}

export async function deleteBudgetAction(id: string) {
  const userId = await requireUserId();
  const budget = await prisma.budget.findFirst({
    where: { id, userId }
  });

  if (budget) {
    await prisma.budget.delete({ where: { id } });
  }

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  redirect("/budgets");
}
