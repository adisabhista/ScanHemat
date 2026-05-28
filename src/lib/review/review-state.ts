import type { ParsedReceipt } from "@/lib/parser/receipt-parser";

export type ReviewState = {
  needsReview: boolean;
  reasons: string[];
};

const lowConfidenceThreshold = 0.8;

export function getReceiptReviewState(parsedReceipt: ParsedReceipt, options: { lowOcrConfidence?: boolean } = {}): ReviewState {
  const reasons = new Set<string>();

  if (options.lowOcrConfidence) {
    reasons.add("Kualitas OCR rendah.");
  }

  if (parsedReceipt.confidence === "low") {
    reasons.add("Kepercayaan hasil pindai rendah.");
  }

  if (parsedReceipt.fieldConfidences?.totalAmount !== undefined && parsedReceipt.fieldConfidences.totalAmount < lowConfidenceThreshold) {
    reasons.add("Total transaksi perlu diperiksa.");
  }

  if (parsedReceipt.fieldConfidences?.transactionDate !== undefined && parsedReceipt.fieldConfidences.transactionDate < lowConfidenceThreshold) {
    reasons.add("Tanggal transaksi perlu diperiksa.");
  }

  if (parsedReceipt.fieldConfidences?.merchant !== undefined && parsedReceipt.fieldConfidences.merchant < lowConfidenceThreshold) {
    reasons.add("Nama toko perlu diperiksa.");
  }

  if (hasConflictingTotals(parsedReceipt)) {
    reasons.add("Ada beberapa kandidat total transaksi.");
  }

  if (hasWeakFallbackTotal(parsedReceipt)) {
    reasons.add("Total transaksi berasal dari fallback lemah.");
  }

  if ((parsedReceipt.category === "Lainnya" || parsedReceipt.categorySource === "default") && (parsedReceipt.categoryConfidence ?? 1) < lowConfidenceThreshold) {
    reasons.add("Kategori Lainnya perlu diperiksa.");
  }

  if ((parsedReceipt.visionCorrections ?? []).length > 0) {
    reasons.add("Ada rekomendasi AI Visual yang belum diterapkan.");
  }

  for (const warning of parsedReceipt.warnings ?? []) {
    if (warning.trim()) {
      reasons.add(warning);
    }
  }

  for (const warning of parsedReceipt.audit?.warnings ?? []) {
    if (warning.trim()) {
      reasons.add(warning);
    }
  }

  const reasonList = [...reasons];

  return {
    needsReview: reasonList.length > 0,
    reasons: reasonList
  };
}

function hasConflictingTotals(parsedReceipt: ParsedReceipt) {
  const candidates = parsedReceipt.totalCandidates ?? [];

  return new Set(candidates.map((candidate) => candidate.amount)).size > 1;
}

function hasWeakFallbackTotal(parsedReceipt: ParsedReceipt) {
  return (parsedReceipt.totalCandidates ?? []).some(
    (candidate) => candidate.isSelected && /angka terbesar|fallback|akurasi rendah/i.test(candidate.reason)
  ) || (parsedReceipt.warnings ?? []).some((warning) => /angka terbesar|fallback/i.test(warning));
}
