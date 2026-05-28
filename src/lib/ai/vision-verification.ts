import type { AiCorrection, AiReceiptVisionVerification } from "@/lib/ai/types";
import type { ParsedReceipt, ReceiptTotalCandidate } from "@/lib/parser/receipt-parser";
import { parseReceiptDateText } from "@/lib/parser/receipt-date-parser";

const confidenceThreshold = 0.8;
const suspiciousTotalTerms = [
  "HEMAT",
  "DISKON",
  "PROMO",
  "POTONGAN",
  "KEMBALI",
  "PPN",
  "PAJAK",
  "ONGKIR",
  "SHIPPING",
  "BIAYA LAYANAN",
  "VOUCHER",
  "TOTAL KUANTITAS",
  "KUANTITAS"
];

export function shouldSuggestVisionVerification(parsedReceipt: ParsedReceipt) {
  if (parsedReceipt.confidence === "low") {
    return true;
  }

  const fieldConfidences = parsedReceipt.fieldConfidences;
  if (
    (typeof fieldConfidences?.totalAmount === "number" && fieldConfidences.totalAmount < confidenceThreshold) ||
    (typeof fieldConfidences?.transactionDate === "number" && fieldConfidences.transactionDate < confidenceThreshold) ||
    (typeof fieldConfidences?.merchant === "number" && fieldConfidences.merchant < confidenceThreshold)
  ) {
    return true;
  }

  if (hasConflictingTotalCandidates(parsedReceipt.totalCandidates)) {
    return true;
  }

  if (hasSuspiciousSelectedTotal(parsedReceipt.totalCandidates)) {
    return true;
  }

  return (parsedReceipt.warnings ?? []).some((warning) =>
    /kurang yakin|akurasi rendah|angka terbesar|berbeda|konflik|mohon periksa/i.test(warning)
  );
}

export function mergeVisionVerificationResult(
  currentReceipt: ParsedReceipt,
  verification: AiReceiptVisionVerification
): ParsedReceipt {
  const warnings = Array.from(new Set([...(currentReceipt.warnings ?? []), ...(verification.warnings ?? [])]));
  const nextReceipt: ParsedReceipt = {
    ...currentReceipt,
    warnings: warnings.length > 0 ? warnings : undefined,
    confidence: currentReceipt.confidence,
    fieldConfidences: {
      ...currentReceipt.fieldConfidences,
      merchant: verification.merchant.confidence,
      transactionDate: verification.transactionDate.confidence,
      totalAmount: verification.totalAmount.confidence
    },
    visionCorrections: mergeCorrections(currentReceipt.visionCorrections, enrichCorrections(verification))
  };

  if (nextReceipt.fieldConfidences) {
    const confidenceValues = Object.values(nextReceipt.fieldConfidences).filter(
      (value): value is number => typeof value === "number"
    );
    nextReceipt.confidence = confidenceValues.some((value) => value < confidenceThreshold) ? "low" : "high";
  }

  return nextReceipt;
}

export function applyVisionCorrection(currentReceipt: ParsedReceipt, correction: AiCorrection): ParsedReceipt {
  if (correction.newValue === null) {
    return currentReceipt;
  }

  if (correction.field === "merchant" && typeof correction.newValue === "string") {
    return { ...currentReceipt, merchant: correction.newValue };
  }

  if (correction.field === "transactionDate" && typeof correction.newValue === "string") {
    const parsedDate = parseReceiptDateText(correction.sourceText ?? correction.newValue);
    const fallbackDate = parsedDate.isoDate ? parsedDate : parseReceiptDateText(correction.newValue);

    return fallbackDate.isoDate
      ? {
          ...currentReceipt,
          transactionDate: fallbackDate.isoDate,
          dateDebug: [...(currentReceipt.dateDebug ?? []), fallbackDate.debug]
        }
      : currentReceipt;
  }

  if (correction.field === "totalAmount" && typeof correction.newValue === "number" && correction.newValue > 0) {
    return { ...currentReceipt, totalAmount: correction.newValue };
  }

  if (correction.field === "category" && typeof correction.newValue === "string") {
    return { ...currentReceipt, category: correction.newValue as ParsedReceipt["category"] };
  }

  return currentReceipt;
}

function hasConflictingTotalCandidates(totalCandidates: ReceiptTotalCandidate[] | undefined) {
  if (!totalCandidates || totalCandidates.length < 2) {
    return false;
  }

  const amounts = new Set(totalCandidates.map((candidate) => candidate.amount));

  return amounts.size > 1;
}

function hasSuspiciousSelectedTotal(totalCandidates: ReceiptTotalCandidate[] | undefined) {
  const selectedCandidate = totalCandidates?.find((candidate) => candidate.isSelected);

  if (!selectedCandidate) {
    return false;
  }

  const sourceText = selectedCandidate.sourceText.toUpperCase();
  const reason = selectedCandidate.reason.toUpperCase();

  return suspiciousTotalTerms.some((term) => sourceText.includes(term)) || reason.includes("ANGKA TERBESAR");
}

function mergeCorrections(existing: AiCorrection[] | undefined, incoming: AiCorrection[]) {
  const corrections = [...(existing ?? []), ...incoming];
  const seen = new Set<string>();

  return corrections.filter((correction) => {
    const key = `${correction.field}:${correction.oldValue ?? ""}:${correction.newValue ?? ""}:${correction.reason}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function enrichCorrections(verification: AiReceiptVisionVerification) {
  return verification.corrections.map((correction) => {
    if (correction.confidence !== undefined || correction.sourceText !== undefined) {
      return correction;
    }

    if (correction.field === "merchant") {
      return { ...correction, confidence: verification.merchant.confidence, sourceText: verification.merchant.sourceText };
    }

    if (correction.field === "transactionDate") {
      return { ...correction, confidence: verification.transactionDate.confidence, sourceText: verification.transactionDate.sourceText };
    }

    if (correction.field === "totalAmount") {
      return { ...correction, confidence: verification.totalAmount.confidence, sourceText: verification.totalAmount.sourceText };
    }

    return correction;
  });
}
