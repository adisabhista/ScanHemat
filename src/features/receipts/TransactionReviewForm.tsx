"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Select } from "@/components/ui/Select";
import { createTransactionAction } from "@/features/transactions/actions";
import { applyVisionCorrection, shouldSuggestVisionVerification } from "@/lib/ai/vision-verification";
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

      setCurrentReceipt(payload.parsed);
      setVisionStatus("success");
      setVisionMessage("AI Visual selesai menganalisis struk. Rekomendasi perlu diterapkan manual.");
    } catch (error) {
      setVisionStatus("error");
      setVisionMessage(error instanceof Error ? error.message : "Analisis AI Visual gagal. Mohon periksa hasil secara manual.");
    }
  }

  const datePreview = formatIndonesianDateLabel(transactionDate);
  const corrections = currentReceipt.visionCorrections ?? [];
  const audit = currentReceipt.audit;
  const isMarkedForReview =
    currentReceipt.confidence === "low" ||
    corrections.length > 0 ||
    (currentReceipt.warnings ?? []).length > 0 ||
    (currentReceipt.audit?.warnings ?? []).length > 0;

  function applyCorrection(correction: NonNullable<ParsedReceipt["visionCorrections"]>[number]) {
    const nextReceipt = applyVisionCorrection(currentReceipt, correction);

    setCurrentReceipt(nextReceipt);

    if (correction.field === "merchant" && typeof correction.newValue === "string") {
      setMerchant(correction.newValue);
    }

    if (correction.field === "transactionDate" && nextReceipt.transactionDate) {
      setTransactionDate(nextReceipt.transactionDate);
    }

    if (correction.field === "totalAmount" && typeof correction.newValue === "number") {
      setTotalAmount(String(correction.newValue));
    }

    if (correction.field === "category" && typeof correction.newValue === "string") {
      const matchedCategory = categories.find((category) => category.name.toLocaleLowerCase("id-ID") === correction.newValue?.toString().toLocaleLowerCase("id-ID"));

      if (matchedCategory) {
        setCategoryId(matchedCategory.id);
      }
    }
  }

  return (
    <Card>
      <SectionHeader title="Periksa Data Transaksi" description="Ubah hasil pindai sebelum menyimpan transaksi." />

      {currentReceipt.warnings && currentReceipt.warnings.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
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

      {isMarkedForReview ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          Hasil ini ditandai Perlu Dicek.
        </div>
      ) : null}

      {shouldShowVisionAction ? (
        <div className="mt-4 grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-medium">Hasil kurang yakin. Mohon periksa kembali sebelum menyimpan.</p>
          {mimeType === "application/pdf" ? (
            <p>Untuk PDF, AI Visual akan dicoba jika model mendukung analisis PDF.</p>
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
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <h3 className="font-semibold text-slate-950 dark:text-slate-100">Rekomendasi AI Visual</h3>
          <p className="mt-1 text-amber-700 dark:text-amber-100">Periksa kembali rekomendasi AI sebelum menyimpan.</p>
          <div className="mt-3 grid gap-3">
            {corrections.map((correction, index) => (
              <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" key={`${correction.field}-${index}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950 dark:text-slate-100">{getCorrectionFieldLabel(correction.field)}</p>
                    <p className="mt-1 text-sm">{formatCorrection(correction)}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Nilai lama: {formatCorrectionValue(correction.oldValue)} - Saran: {formatCorrectionValue(correction.newValue)}
                    </p>
                    {typeof correction.confidence === "number" ? (
                      <p className="mt-1 text-xs text-slate-500">Keyakinan {Math.round(correction.confidence * 100)}%</p>
                    ) : null}
                  </div>
                  <Button onClick={() => applyCorrection(correction)} type="button" variant="secondary">
                    Terapkan
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {audit ? (
        <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <summary className="cursor-pointer list-none">
            <span className="block font-semibold text-slate-950">Audit Struk</span>
            <span className="mt-1 block text-slate-500">Lihat alasan AI memilih data ini.</span>
          </summary>
          <div className="mt-4 grid gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-semibold text-slate-950">Ringkasan audit</h3>
                <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${getAuditConfidenceClass(audit.confidence)}`}>
                  {getAuditConfidenceLabel(audit.confidence)}
                </span>
              </div>
              <p className="mt-2 leading-6">{audit.summary}</p>
            </div>

            <div className="grid gap-2">
              <h3 className="font-semibold text-slate-950">Alasan pemilihan</h3>
              <div className="grid gap-2">
                {Object.entries(audit.selectedFields).map(([field, value]) =>
                  value ? <AuditFieldRow field={field} key={field} value={value} /> : null
                )}
              </div>
            </div>

            <AuditCandidateList candidates={audit.acceptedCandidates} title="Kandidat diterima" />
            <AuditCandidateList candidates={audit.rejectedCandidates} title="Kandidat ditolak" />

            {audit.warnings.length > 0 ? (
              <div className="grid gap-2">
                <h3 className="font-semibold text-slate-950">Peringatan</h3>
                <ul className="list-disc space-y-1 pl-5 text-amber-700">
                  {audit.warnings.map((warning, index) => (
                    <li key={`${warning}-${index}`}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      <form action={createTransactionAction} className="mt-5 grid gap-4">
        <input name="receiptId" type="hidden" value={receiptId} />
        <input name="items" type="hidden" value={serializedItems} />
        <Input
          label="Toko"
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
            className="min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
            <div className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_160px_auto] dark:border-slate-700" key={`${item.name}-${index}`}>
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
                className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
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

function AuditFieldRow({
  field,
  value
}: {
  field: string;
  value: NonNullable<NonNullable<ParsedReceipt["audit"]>["selectedFields"][keyof NonNullable<ParsedReceipt["audit"]>["selectedFields"]]>;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium text-slate-950">{getAuditFieldLabel(field)}</p>
          <p className="mt-1">{formatAuditValue(value.value)}</p>
        </div>
        <span className="text-xs text-slate-500">Keyakinan {Math.round(value.confidence * 100)}%</span>
      </div>
      {value.sourceText ? <p className="mt-2 text-xs text-slate-500">Sumber: {value.sourceText}</p> : null}
      <p className="mt-2 text-sm">{value.reason}</p>
    </div>
  );
}

function AuditCandidateList({
  candidates,
  title
}: {
  candidates: NonNullable<ParsedReceipt["audit"]>["acceptedCandidates"];
  title: string;
}) {
  if (candidates.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2">
      <h3 className="font-semibold text-slate-950">{title}</h3>
      <div className="grid gap-2">
        {candidates.map((candidate, index) => (
          <div className="rounded-md border border-slate-200 p-3" key={`${candidate.field}-${candidate.sourceText}-${index}`}>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <p className="font-medium text-slate-950">{getAuditFieldLabel(candidate.field)}</p>
              <span className="text-xs text-slate-500">{formatAuditValue(candidate.value)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{candidate.sourceText}</p>
            <p className="mt-2">{candidate.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function getAuditFieldLabel(field: string) {
  const labels: Record<string, string> = {
    merchant: "Toko",
    transactionDate: "Tanggal",
    totalAmount: "Total",
    category: "Kategori",
    discount: "Diskon",
    shipping: "Pengiriman/Biaya",
    item: "Item"
  };

  return labels[field] ?? field;
}

function getAuditConfidenceLabel(confidence: NonNullable<ParsedReceipt["audit"]>["confidence"]) {
  if (confidence === "high") {
    return "Kepercayaan tinggi";
  }

  if (confidence === "medium") {
    return "Kepercayaan sedang";
  }

  return "Kepercayaan rendah";
}

function getAuditConfidenceClass(confidence: NonNullable<ParsedReceipt["audit"]>["confidence"]) {
  if (confidence === "high") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (confidence === "medium") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-red-50 text-red-700";
}

function formatAuditValue(value: string | number | null) {
  if (value === null) {
    return "-";
  }

  if (typeof value === "number") {
    return formatCurrency(value);
  }

  return value;
}

function formatCorrection(correction: NonNullable<ParsedReceipt["visionCorrections"]>[number]) {
  return `AI Visual menyarankan ${getCorrectionFieldLabel(correction.field)} menjadi ${formatCorrectionValue(correction.newValue)} karena ${correction.reason}`;
}

function getCorrectionFieldLabel(field: NonNullable<ParsedReceipt["visionCorrections"]>[number]["field"]) {
  const fieldLabel: Record<typeof field, string> = {
    merchant: "Toko",
    transactionDate: "Tanggal",
    totalAmount: "Total",
    items: "Item",
    category: "Kategori"
  };

  return fieldLabel[field];
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
