"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createTransactionAction } from "@/features/transactions/actions";
import { shouldSuggestVisionVerification } from "@/lib/ai/vision-verification";
import { formatCurrency } from "@/lib/format/currency";
import { formatIndonesianDateLabel } from "@/lib/format/date";
import type { ParsedReceiptItem, ParsedReceipt } from "@/lib/parser/receipt-parser";

type CategoryOption = {
  id: string;
  name: string;
};

type VisionVerifyResult = {
  parsed: ParsedReceipt;
  corrections?: ParsedReceipt["visionCorrections"];
  error?: string;
};

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionReviewForm({
  receiptId,
  parsedReceipt,
  categories,
  mimeType
}: {
  receiptId: string;
  parsedReceipt: ParsedReceipt;
  categories: CategoryOption[];
  mimeType: string;
}) {
  const defaultCategory = categories.find((category) => category.name === "Lainnya") ?? categories[0];
  const [currentReceipt, setCurrentReceipt] = useState(parsedReceipt);
  const [merchant, setMerchant] = useState(parsedReceipt.merchant ?? "");
  const [items, setItems] = useState<ParsedReceiptItem[]>(parsedReceipt.items ?? []);
  const [transactionDate, setTransactionDate] = useState(parsedReceipt.transactionDate ?? getTodayInputValue());
  const [totalAmount, setTotalAmount] = useState(parsedReceipt.totalAmount?.toString() ?? "");
  const [categoryId, setCategoryId] = useState(parsedReceipt.categoryId ?? defaultCategory?.id ?? "");
  const [visionStatus, setVisionStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [visionMessage, setVisionMessage] = useState("");
  const serializedItems = useMemo(() => JSON.stringify(items.filter((item) => item.name.trim())), [items]);
  const shouldShowVisionAction = shouldSuggestVisionVerification(currentReceipt);

  function applyParsedReceipt(nextReceipt: ParsedReceipt) {
    setCurrentReceipt(nextReceipt);
    setMerchant(nextReceipt.merchant ?? "");
    setItems(nextReceipt.items ?? []);
    setTransactionDate(nextReceipt.transactionDate ?? getTodayInputValue());
    setTotalAmount(nextReceipt.totalAmount?.toString() ?? "");
    setCategoryId(nextReceipt.categoryId ?? defaultCategory?.id ?? "");
  }

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

  async function verifyWithVision() {
    setVisionStatus("loading");
    setVisionMessage("AI Visual sedang menganalisis struk...");

    try {
      const response = await fetch(`/api/receipts/${receiptId}/vision-verify`, {
        method: "POST"
      });
      const payload = (await response.json()) as VisionVerifyResult;

      if (!response.ok) {
        throw new Error(payload.error || "Analisis AI Visual gagal. Mohon periksa hasil secara manual.");
      }

      applyParsedReceipt(payload.parsed);
      setVisionStatus("success");
      setVisionMessage("AI Visual selesai menganalisis struk.");
    } catch (error) {
      setVisionStatus("error");
      setVisionMessage(error instanceof Error ? error.message : "Analisis AI Visual gagal. Mohon periksa hasil secara manual.");
    }
  }

  const datePreview = formatIndonesianDateLabel(transactionDate);
  const corrections = currentReceipt.visionCorrections ?? [];

  return (
    <Card>
      <h2 className="text-base font-semibold text-slate-950">Periksa Data Transaksi</h2>
      <p className="mt-1 text-sm text-slate-500">Ubah hasil pindai sebelum menyimpan transaksi.</p>

      {currentReceipt.warnings && currentReceipt.warnings.length > 0 && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-medium text-amber-800">Perhatian</h3>
          <div className="mt-2 text-sm text-amber-700">
            <ul className="list-disc space-y-1 pl-5">
              {currentReceipt.warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {shouldShowVisionAction ? (
        <div className="mt-4 grid gap-3 rounded-md border border-brand-100 bg-brand-50 p-4 text-sm text-brand-800">
          <p>Hasil kurang yakin. Anda dapat menganalisis ulang dengan AI Visual.</p>
          {mimeType === "application/pdf" ? (
            <p className="text-brand-700">Untuk PDF, AI Visual akan dicoba jika model mendukung analisis PDF.</p>
          ) : null}
          <Button disabled={visionStatus === "loading"} onClick={verifyWithVision} type="button" variant="secondary">
            Analisis Ulang dengan AI Visual
          </Button>
        </div>
      ) : null}

      {visionMessage ? (
        <p
          className={`mt-4 rounded-md p-3 text-sm ${
            visionStatus === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {visionMessage}
        </p>
      ) : null}

      {corrections.length > 0 ? (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <h3 className="font-semibold text-slate-950">Saran AI Visual</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {corrections.map((correction, index) => (
              <li key={`${correction.field}-${index}`}>{formatCorrection(correction)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form action={createTransactionAction} className="mt-5 grid gap-4">
        <input name="receiptId" type="hidden" value={receiptId} />
        <input name="items" type="hidden" value={serializedItems} />
        <Input
          label="Merchant / Toko"
          name="merchant"
          onChange={(event) => setMerchant(event.target.value)}
          placeholder="Nama toko"
          value={merchant}
        />
        <div>
          <Input
            value={transactionDate}
            onChange={(event) => setTransactionDate(event.target.value)}
            label="Tanggal"
            name="transactionDate"
            required
            type="date"
          />
          {datePreview ? <p className="mt-1 text-xs text-slate-500">Tanggal terpilih: {datePreview}</p> : null}
        </div>
        <Input
          label="Total"
          min="0"
          name="totalAmount"
          onChange={(event) => setTotalAmount(event.target.value)}
          required
          step="1"
          type="number"
          value={totalAmount}
        />
        <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} label="Kategori" name="categoryId" required>
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

function formatCorrection(correction: NonNullable<ParsedReceipt["visionCorrections"]>[number]) {
  const fieldLabel: Record<typeof correction.field, string> = {
    merchant: "merchant",
    transactionDate: "tanggal",
    totalAmount: "total",
    items: "item",
    category: "kategori"
  };

  return `AI Visual menyarankan ${fieldLabel[correction.field]} ${formatCorrectionValue(correction.newValue)} karena ${correction.reason}`;
}

function formatCorrectionValue(value: string | number | null) {
  if (value === null) {
    return "-";
  }

  if (typeof value === "number") {
    return formatCurrency(value);
  }

  return value;
}
