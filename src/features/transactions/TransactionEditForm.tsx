"use client";

import type { Category, TransactionItem } from "@prisma/client";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PendingSubmitButton } from "@/components/ui/PendingSubmitButton";
import { RupiahInput } from "@/components/ui/RupiahInput";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { deleteTransactionAction, markTransactionReviewedAction, updateTransactionAction } from "@/features/transactions/actions";
import { TransactionItemsEditor, type EditableTransactionItem } from "@/features/transactions/TransactionItemsEditor";
import { TransactionSourceBadge } from "@/features/transactions/TransactionSourceBadge";
import { toInputDate, formatIndonesianDateLabel } from "@/lib/format/date";

export function TransactionEditForm({
  transaction,
  categories
}: {
  transaction: {
    id: string;
    merchant: string | null;
    transactionDate: Date;
    categoryId: string;
    totalAmount: { toString(): string };
    notes: string | null;
    source: "MANUAL" | "RECEIPT_OCR" | "PDF_OCR";
    needsReview: boolean;
    reviewReason: unknown;
    items: TransactionItem[];
  };
  categories: Category[];
}) {
  const [items, setItems] = useState<EditableTransactionItem[]>(
    transaction.items.map((item) => ({
      name: item.name,
      quantity: item.quantity?.toString(),
      unitPrice: item.unitPrice?.toString(),
      totalPrice: item.totalPrice?.toString()
    }))
  );
  const [transactionDate, setTransactionDate] = useState(toInputDate(transaction.transactionDate));
  const serializedItems = useMemo(
    () =>
      JSON.stringify(
        items
          .filter((item) => item.name.trim())
          .map((item) => ({
            name: item.name,
            quantity: item.quantity ? Number(item.quantity) : undefined,
            unitPrice: item.unitPrice ? Number(item.unitPrice) : undefined,
            totalPrice: item.totalPrice ? Number(item.totalPrice) : undefined
          }))
      ),
    [items]
  );
  const updateAction = updateTransactionAction.bind(null, transaction.id);
  const deleteAction = deleteTransactionAction.bind(null, transaction.id);
  const markReviewedAction = markTransactionReviewedAction.bind(null, transaction.id);
  const reviewReasons = Array.isArray(transaction.reviewReason)
    ? transaction.reviewReason.filter((reason): reason is string => typeof reason === "string")
    : [];

  const datePreview = formatIndonesianDateLabel(transactionDate);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">Detail Transaksi</h2>
        <div className="flex flex-wrap justify-end gap-2">
          {transaction.needsReview ? <StatusBadge tone="amber">Perlu Dicek</StatusBadge> : null}
          <TransactionSourceBadge source={transaction.source} />
        </div>
      </div>
      {transaction.needsReview ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-semibold">Transaksi ini ditandai Perlu Dicek.</p>
          {reviewReasons.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {reviewReasons.map((reason, index) => (
                <li key={`${reason}-${index}`}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <form action={updateAction} className="grid gap-4">
        <input name="items" type="hidden" value={serializedItems} />
        <Input defaultValue={transaction.merchant ?? ""} label="Toko" name="merchant" />
        <div>
          <Input
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
            label="Tanggal"
            name="transactionDate"
            required
            type="date"
          />
          {datePreview ? (
            <p className="mt-1 text-xs text-slate-500">Tanggal terpilih: {datePreview}</p>
          ) : null}
        </div>
        <RupiahInput defaultValue={transaction.totalAmount.toString()} label="Total" min="0" name="totalAmount" required />
        <Select defaultValue={transaction.categoryId} label="Kategori" name="categoryId" required>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          <span>Catatan</span>
          <textarea
            className="min-h-24 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            defaultValue={transaction.notes ?? ""}
            name="notes"
          />
        </label>
        <TransactionItemsEditor items={items} onItemsChange={setItems} />
        <div className="flex flex-col gap-3 sm:flex-row">
          <PendingSubmitButton />
          <Button formAction={deleteAction} type="submit" variant="danger">
            Hapus
          </Button>
          {transaction.needsReview ? (
            <Button formAction={markReviewedAction} type="submit" variant="secondary">
              Tandai Sudah Dicek
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
