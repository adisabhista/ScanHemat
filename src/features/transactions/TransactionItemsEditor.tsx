"use client";

import { Input } from "@/components/ui/Input";
import { RupiahInput } from "@/components/ui/RupiahInput";

export type EditableTransactionItem = {
  name: string;
  quantity?: string;
  unitPrice?: string;
  totalPrice?: string;
};

export function shouldShowUnitPrice(item: EditableTransactionItem) {
  const quantity = item.quantity?.trim();
  const hasNonSingleQuantity = Boolean(quantity) && Number(quantity) !== 1;
  const hasDistinctUnitPrice = Boolean(item.unitPrice) && item.unitPrice !== item.totalPrice;

  return hasNonSingleQuantity || hasDistinctUnitPrice;
}

export function TransactionItemsEditor({
  items,
  onItemsChange
}: {
  items: EditableTransactionItem[];
  onItemsChange: (items: EditableTransactionItem[]) => void;
}) {
  function updateItem(index: number, field: keyof EditableTransactionItem, value: string) {
    onItemsChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Item opsional</h3>
        <button
          className="text-sm font-semibold text-brand-700 dark:text-brand-100"
          onClick={() => onItemsChange([...items, { name: "" }])}
          type="button"
        >
          Tambah item
        </button>
      </div>
      {items.length === 0 ? <p className="text-sm text-slate-500">Belum ada item.</p> : null}
      {items.length > 0 ? (
        <div className="hidden grid-cols-[minmax(0,1fr)_72px_140px_140px_auto] gap-2 px-3 text-xs font-semibold uppercase text-slate-500 sm:grid">
          <span>Nama Item</span>
          <span>Qty</span>
          <span>Harga Satuan</span>
          <span>Total Item</span>
          <span className="text-right">Aksi</span>
        </div>
      ) : null}
      {items.map((item, index) => {
        const showUnitPrice = shouldShowUnitPrice(item);

        return (
          <div
            className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_72px_140px_140px_auto] sm:items-end sm:gap-2 dark:border-slate-700"
            key={index}
          >
            <div className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-500 sm:hidden">Nama Item</span>
              <Input
                aria-label="Nama Item"
                onChange={(event) => updateItem(index, "name", event.target.value)}
                placeholder="Nama item"
                value={item.name}
              />
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-500 sm:hidden">Qty</span>
              <Input
                aria-label="Qty"
                inputMode="decimal"
                min="0"
                onChange={(event) => updateItem(index, "quantity", event.target.value)}
                placeholder="1"
                step="any"
                type="number"
                value={item.quantity ?? ""}
              />
            </div>
            {showUnitPrice ? (
              <div className="grid gap-1.5">
                <span className="text-xs font-semibold text-slate-500 sm:hidden">Harga Satuan</span>
                <RupiahInput
                  aria-label="Harga Satuan"
                  min="0"
                  onValueChange={(value) => updateItem(index, "unitPrice", value)}
                  placeholder="Harga satuan"
                  value={item.unitPrice ?? ""}
                />
              </div>
            ) : (
              <span className="hidden min-h-10 items-center text-sm text-slate-400 sm:flex">-</span>
            )}
            <div className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-500 sm:hidden">Total Item</span>
              <RupiahInput
                aria-label="Total Item"
                min="0"
                onValueChange={(value) => updateItem(index, "totalPrice", value)}
                placeholder="Total item"
                value={item.totalPrice ?? ""}
              />
            </div>
            <button
              className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 sm:justify-self-end dark:hover:bg-red-500/10"
              onClick={() => onItemsChange(items.filter((_, itemIndex) => itemIndex !== index))}
              type="button"
            >
              Hapus
            </button>
          </div>
        );
      })}
    </div>
  );
}
