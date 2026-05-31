"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PendingSubmitButton } from "@/components/ui/PendingSubmitButton";
import { RupiahInput } from "@/components/ui/RupiahInput";
import { Select } from "@/components/ui/Select";
import { createTransactionAction } from "@/features/transactions/actions";
import { TransactionItemsEditor, type EditableTransactionItem } from "@/features/transactions/TransactionItemsEditor";
import { formatIndonesianDateLabel } from "@/lib/format/date";

type CategoryOption = {
  id: string;
  name: string;
};

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function ManualTransactionForm({ categories }: { categories: CategoryOption[] }) {
  const defaultCategory = categories.find((category) => category.name === "Lainnya") ?? categories[0];
  const [items, setItems] = useState<EditableTransactionItem[]>([]);
  const [transactionDate, setTransactionDate] = useState(getTodayInputValue());
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

  const datePreview = formatIndonesianDateLabel(transactionDate);

  return (
    <Card>
      <form action={createTransactionAction} className="grid gap-4">
        <input name="items" type="hidden" value={serializedItems} />
        <Input label="Toko" name="merchant" placeholder="Nama toko" />
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
        <Select defaultValue={defaultCategory?.id} label="Kategori" name="categoryId" required>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <RupiahInput label="Total" min="0" name="totalAmount" required />
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          <span>Catatan</span>
          <textarea
            className="min-h-24 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            name="notes"
            placeholder="Catatan tambahan"
          />
        </label>
        <TransactionItemsEditor items={items} onItemsChange={setItems} />
        <PendingSubmitButton />
      </form>
    </Card>
  );
}
