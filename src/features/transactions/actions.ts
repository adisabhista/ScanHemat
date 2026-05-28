"use server";

import { Prisma, TransactionSource } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ensureCategoryAccess } from "@/features/categories/queries";
import { buildTransactionReviewData, markTransactionReviewedForUser, type ReceiptReviewData } from "@/features/transactions/review";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DASHBOARD_ROUTE, NEW_TRANSACTION_ROUTE, SCAN_RECEIPT_ROUTE, TRANSACTIONS_ROUTE } from "@/lib/routes";
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
  const errorPath = formData.get("receiptId") ? SCAN_RECEIPT_ROUTE : NEW_TRANSACTION_ROUTE;

  if (!parsed.success) {
    redirect(`${errorPath}?error=${encodeURIComponent(parsed.error.errors[0]?.message ?? "Gagal menyimpan transaksi. Silakan coba lagi.")}`);
  }

  await ensureCategoryAccess(userId, parsed.data.categoryId);
  let transactionSource: TransactionSource = TransactionSource.MANUAL;
  let receiptReview: ReceiptReviewData = null;

  if (parsed.data.receiptId) {
    const receipt = await prisma.receipt.findFirst({
      where: {
        id: parsed.data.receiptId,
        userId
      },
      select: {
        mimeType: true,
        needsReview: true,
        reviewReasons: true,
        reviewedAt: true
      }
    });

    if (!receipt) {
      redirect(`${SCAN_RECEIPT_ROUTE}?error=${encodeURIComponent("Gagal menyimpan transaksi. Silakan coba lagi.")}`);
    }

    receiptReview = {
      needsReview: receipt.needsReview,
      reviewReasons: receipt.reviewReasons,
      reviewedAt: receipt.reviewedAt
    };
    transactionSource = receipt.mimeType === "application/pdf" ? TransactionSource.PDF_OCR : TransactionSource.RECEIPT_OCR;
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
      source: transactionSource,
      ...buildTransactionReviewData(receiptReview),
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

  revalidatePath(DASHBOARD_ROUTE);
  revalidatePath(TRANSACTIONS_ROUTE);
  redirect(TRANSACTIONS_ROUTE);
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

  revalidatePath(DASHBOARD_ROUTE);
  revalidatePath(TRANSACTIONS_ROUTE);
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

  revalidatePath(DASHBOARD_ROUTE);
  revalidatePath(TRANSACTIONS_ROUTE);
  redirect(TRANSACTIONS_ROUTE);
}

export async function markTransactionReviewedAction(id: string) {
  const userId = await requireUserId();
  const result = await markTransactionReviewedForUser(userId, id);

  if (!result) {
    redirect(TRANSACTIONS_ROUTE);
  }

  revalidatePath(DASHBOARD_ROUTE);
  revalidatePath(TRANSACTIONS_ROUTE);
  revalidatePath(`/transactions/${id}`);
  redirect(`/transactions/${id}`);
}
