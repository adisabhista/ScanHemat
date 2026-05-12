"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createTransactionAction } from "@/features/transactions/actions";
import type { ParsedReceiptItem, ParsedReceipt } from "@/lib/parser/receipt-parser";

type CategoryOption = {
  id: string;
  name: string;
};

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionReviewForm({
  receiptId,
  parsedReceipt,
  categories
}: {
  receiptId: string;
  parsedReceipt: ParsedReceipt;
  categories: CategoryOption[];
}) {
  const defaultCategory = categories.find((category) => category.name === "Lainnya") ?? categories[0];
  const [items, setItems] = useState<ParsedReceiptItem[]>(parsedReceipt.items ?? []);
  const serializedItems = useMemo(() => JSON.stringify(items.filter((item) => item.name.trim())), [items]);

  function updateItem(index: number, field: keyof ParsedReceiptItem, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: field === "name" ? value : value ? Number(value) : undefined
            }
          : item
      )
    );
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-slate-950">Periksa Data Transaksi</h2>
      <p className="mt-1 text-sm text-slate-500">Ubah hasil pindai sebelum menyimpan transaksi.</p>
      <form action={createTransactionAction} className="mt-5 grid gap-4">
        <input name="receiptId" type="hidden" value={receiptId} />
        <input name="items" type="hidden" value={serializedItems} />
        <Input defaultValue={parsedReceipt.merchant ?? ""} label="Merchant" name="merchant" placeholder="Nama toko" />
        <Input
          defaultValue={parsedReceipt.transactionDate ?? getTodayInputValue()}
          label="Tanggal"
          name="transactionDate"
          required
          type="date"
        />
        <Input
          defaultValue={parsedReceipt.totalAmount ?? ""}
          label="Total"
          min="0"
          name="totalAmount"
          required
          step="1"
          type="number"
        />
        <Select defaultValue={defaultCategory?.id} label="Kategori" name="categoryId" required>
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
            name="notes"
            placeholder="Catatan tambahan"
          />
        </label>
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Item</h3>
            <button
              className="text-sm font-semibold text-brand-700"
              onClick={() => setItems((current) => [...current, { name: "", totalPrice: undefined }])}
              type="button"
            >
              Tambah item
            </button>
          </div>
          {items.length === 0 ? <p className="text-sm text-slate-500">Belum ada item terbaca.</p> : null}
          {items.map((item, index) => (
            <div className="grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-[1fr_160px_auto]" key={`${item.name}-${index}`}>
              <Input
                aria-label="Nama item"
                value={item.name}
                onChange={(event) => updateItem(index, "name", event.target.value)}
                placeholder="Nama item"
              />
              <Input
                aria-label="Harga item"
                min="0"
                step="1"
                type="number"
                value={item.totalPrice ?? ""}
                onChange={(event) => updateItem(index, "totalPrice", event.target.value)}
                placeholder="Harga"
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
        <Button type="submit">Simpan</Button>
      </form>
    </Card>
  );
}
