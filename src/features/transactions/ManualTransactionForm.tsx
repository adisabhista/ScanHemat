"use client";

import type { Category } from "@prisma/client";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createTransactionAction } from "@/features/transactions/actions";

type ManualItem = {
  name: string;
  quantity?: string;
  unitPrice?: string;
  totalPrice?: string;
};

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function ManualTransactionForm({ categories }: { categories: Category[] }) {
  const defaultCategory = categories.find((category) => category.name === "Lainnya") ?? categories[0];
  const [items, setItems] = useState<ManualItem[]>([]);
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

  function updateItem(index: number, field: keyof ManualItem, value: string) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
  }

  return (
    <Card>
      <form action={createTransactionAction} className="grid gap-4">
        <input name="items" type="hidden" value={serializedItems} />
        <Input label="Merchant / Toko" name="merchant" placeholder="Nama toko" />
        <Input defaultValue={getTodayInputValue()} label="Tanggal" name="transactionDate" required type="date" />
        <Select defaultValue={defaultCategory?.id} label="Kategori" name="categoryId" required>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Input label="Total" min="0" name="totalAmount" required step="1" type="number" />
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          <span>Catatan</span>
          <textarea
            className="min-h-24 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            name="notes"
            placeholder="Catatan tambahan"
          />
        </label>
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">Item opsional</h2>
            <button
              className="text-sm font-semibold text-brand-700"
              onClick={() => setItems((current) => [...current, { name: "" }])}
              type="button"
            >
              Tambah item
            </button>
          </div>
          {items.length === 0 ? <p className="text-sm text-slate-500">Belum ada item.</p> : null}
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
        <Button type="submit">Simpan</Button>
      </form>
    </Card>
  );
}
