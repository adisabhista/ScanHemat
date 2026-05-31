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
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Item opsional</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Harga satuan boleh kosong jika tidak terbaca dari struk.
          </p>
        </div>
        <button
          className="shrink-0 text-sm font-semibold text-brand-700 dark:text-brand-100"
          onClick={() => onItemsChange([...items, { name: "" }])}
          type="button"
        >
          Tambah item
        </button>
      </div>
      {items.length === 0 ? <p className="text-sm text-slate-500">Belum ada item.</p> : null}
      {items.length > 0 ? (
        <div className="hidden grid-cols-[minmax(280px,1fr)_96px_150px_150px_88px] gap-3 px-3 text-xs font-semibold uppercase text-slate-500 xl:grid">
          <span>Nama Item</span>
          <span className="text-center">Qty</span>
          <span className="text-right">Harga Satuan</span>
          <span className="text-right">Total Item</span>
          <span className="text-center">Aksi</span>
        </div>
      ) : null}
      {items.map((item, index) => {
        const showUnitPrice = shouldShowUnitPrice(item);

        return (
          <div
            className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_96px_150px_150px_88px] xl:items-end dark:border-slate-700 dark:bg-slate-800/30"
            key={index}
          >
            <div className="grid gap-1.5 sm:col-span-2 xl:col-span-1">
              <span className="text-xs font-semibold text-slate-500 xl:hidden">Nama Item</span>
              <Input
                aria-label="Nama Item"
                className="h-10"
                onChange={(event) => updateItem(index, "name", event.target.value)}
                placeholder="Nama item"
                value={item.name}
              />
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-500 xl:hidden">Qty</span>
              <Input
                aria-label="Qty"
                className="h-10 text-center"
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
                <span className="text-xs font-semibold text-slate-500 xl:hidden">Harga Satuan</span>
                <RupiahInput
                  aria-label="Harga Satuan"
                  className="h-10 text-right"
                  min="0"
                  onValueChange={(value) => updateItem(index, "unitPrice", value)}
                  placeholder="Harga satuan"
                  value={item.unitPrice ?? ""}
                />
              </div>
            ) : (
              <div className="grid gap-1.5">
                <span className="text-xs font-semibold text-slate-500 xl:hidden">Harga Satuan</span>
                <Input
                  aria-label="Harga Satuan"
                  className="h-10 cursor-not-allowed bg-slate-100 text-right dark:bg-slate-800"
                  disabled
                  placeholder=""
                  value=""
                />
              </div>
            )}
            <div className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-500 xl:hidden">Total Item</span>
              <RupiahInput
                aria-label="Total Item"
                className="h-10 text-right"
                min="0"
                onValueChange={(value) => updateItem(index, "totalPrice", value)}
                placeholder="Total item"
                value={item.totalPrice ?? ""}
              />
            </div>
            <button
              className="h-10 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 sm:col-span-2 sm:justify-self-end xl:col-span-1 xl:w-full xl:justify-self-center dark:hover:bg-red-500/10"
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
