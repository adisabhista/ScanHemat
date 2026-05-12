"use server";

import { Prisma, TransactionSource } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ensureCategoryAccess } from "@/features/categories/queries";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { transactionSchema } from "@/lib/validation/transaction";

function parseItems(formData: FormData) {
  const value = formData.get("items");

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    return JSON.parse(value) as unknown[];
  } catch {
    return [];
  }
}

function parseTransactionForm(formData: FormData) {
  return transactionSchema.safeParse({
    receiptId: formData.get("receiptId") || undefined,
    merchant: formData.get("merchant") || undefined,
    transactionDate: formData.get("transactionDate"),
    categoryId: formData.get("categoryId"),
    totalAmount: formData.get("totalAmount"),
    notes: formData.get("notes") || undefined,
    items: parseItems(formData)
  });
}

export async function createTransactionAction(formData: FormData) {
  const userId = await requireUserId();
  const parsed = parseTransactionForm(formData);

  if (!parsed.success) {
    redirect(`/scan?error=${encodeURIComponent(parsed.error.errors[0]?.message ?? "Gagal menyimpan transaksi. Silakan coba lagi.")}`);
  }

  await ensureCategoryAccess(userId, parsed.data.categoryId);

  if (parsed.data.receiptId) {
    const receipt = await prisma.receipt.findFirst({
      where: {
        id: parsed.data.receiptId,
        userId
      }
    });

    if (!receipt) {
      redirect(`/scan?error=${encodeURIComponent("Gagal menyimpan transaksi. Silakan coba lagi.")}`);
    }
  }

  await prisma.transaction.create({
    data: {
      userId,
      receiptId: parsed.data.receiptId ?? undefined,
      merchant: parsed.data.merchant || null,
      transactionDate: parsed.data.transactionDate,
      totalAmount: new Prisma.Decimal(parsed.data.totalAmount),
      categoryId: parsed.data.categoryId,
      notes: parsed.data.notes || null,
      source: parsed.data.receiptId ? TransactionSource.RECEIPT_OCR : TransactionSource.MANUAL,
      items: {
        create:
          parsed.data.items?.map((item) => ({
            name: item.name,
            quantity: item.quantity ? new Prisma.Decimal(item.quantity) : null,
            unitPrice: item.unitPrice ? new Prisma.Decimal(item.unitPrice) : null,
            totalPrice: item.totalPrice ? new Prisma.Decimal(item.totalPrice) : null
          })) ?? []
      }
    }
  });

  if (parsed.data.receiptId) {
    await prisma.receipt.update({
      where: { id: parsed.data.receiptId },
      data: { status: "CONFIRMED" }
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  redirect("/transactions");
}

export async function updateTransactionAction(id: string, formData: FormData) {
  const userId = await requireUserId();
  const parsed = parseTransactionForm(formData);

  if (!parsed.success) {
    redirect(`/transactions/${id}?error=${encodeURIComponent(parsed.error.errors[0]?.message ?? "Gagal menyimpan transaksi. Silakan coba lagi.")}`);
  }

  await ensureCategoryAccess(userId, parsed.data.categoryId);

  const existing = await prisma.transaction.findFirst({
    where: { id, userId }
  });

  if (!existing) {
    redirect("/transactions");
  }

  await prisma.$transaction([
    prisma.transactionItem.deleteMany({
      where: { transactionId: id }
    }),
    prisma.transaction.update({
      where: { id },
      data: {
        merchant: parsed.data.merchant || null,
        transactionDate: parsed.data.transactionDate,
        totalAmount: new Prisma.Decimal(parsed.data.totalAmount),
        categoryId: parsed.data.categoryId,
        notes: parsed.data.notes || null,
        items: {
          create:
            parsed.data.items?.map((item) => ({
              name: item.name,
              quantity: item.quantity ? new Prisma.Decimal(item.quantity) : null,
              unitPrice: item.unitPrice ? new Prisma.Decimal(item.unitPrice) : null,
              totalPrice: item.totalPrice ? new Prisma.Decimal(item.totalPrice) : null
            })) ?? []
        }
      }
    })
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  redirect(`/transactions/${id}`);
}

export async function deleteTransactionAction(id: string) {
  const userId = await requireUserId();
  const existing = await prisma.transaction.findFirst({
    where: { id, userId }
  });

  if (existing) {
    await prisma.transaction.delete({
      where: { id }
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  redirect("/transactions");
}
