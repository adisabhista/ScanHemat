"use client";

import type { Category, TransactionItem } from "@prisma/client";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { deleteTransactionAction, updateTransactionAction } from "@/features/transactions/actions";
import { TransactionSourceBadge } from "@/features/transactions/TransactionSourceBadge";
import { toInputDate, formatIndonesianDateLabel } from "@/lib/format/date";

type EditableItem = {
  name: string;
  quantity?: string;
  unitPrice?: string;
  totalPrice?: string;
};

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
    items: TransactionItem[];
  };
  categories: Category[];
}) {
  const [items, setItems] = useState<EditableItem[]>(
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

  function updateItem(index: number, field: keyof EditableItem, value: string) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
  }

  const datePreview = formatIndonesianDateLabel(transactionDate);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">Detail Transaksi</h2>
        <TransactionSourceBadge source={transaction.source} />
      </div>
      <form action={updateAction} className="grid gap-4">
        <input name="items" type="hidden" value={serializedItems} />
        <Input defaultValue={transaction.merchant ?? ""} label="Merchant / Toko" name="merchant" />
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
        <Input defaultValue={transaction.totalAmount.toString()} label="Total" min="0" name="totalAmount" required step="1" type="number" />
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
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Item</h3>
            <button
              className="text-sm font-semibold text-brand-700"
              onClick={() => setItems((current) => [...current, { name: "" }])}
              type="button"
            >
              Tambah item
            </button>
          </div>
          {items.map((item, index) => (
            <div className="grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-[1fr_120px_120px_auto]" key={index}>
              <Input value={item.name} onChange={(event) => updateItem(index, "name", event.target.value)} placeholder="Nama item" />
              <Input
                min="0"
                step="1"
                type="number"
                value={item.unitPrice ?? ""}
                onChange={(event) => updateItem(index, "unitPrice", event.target.value)}
                placeholder="Harga"
              />
              <Input
                min="0"
                step="1"
                type="number"
                value={item.totalPrice ?? ""}
                onChange={(event) => updateItem(index, "totalPrice", event.target.value)}
                placeholder="Total"
              />
              <button
                className="rounded-md px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                type="button"
              >
                Hapus
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit">Simpan</Button>
          <Button formAction={deleteAction} type="submit" variant="danger">
            Hapus
          </Button>
        </div>
      </form>
    </Card>
  );
}
