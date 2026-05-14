import type { AiCorrection, AiReceiptVisionVerification } from "@/lib/ai/types";
import type { ParsedReceipt, ParsedReceiptItem, ReceiptTotalCandidate } from "@/lib/parser/receipt-parser";
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
    visionCorrections: mergeCorrections(currentReceipt.visionCorrections, verification.corrections)
  };

  if (verification.merchant.value && verification.merchant.confidence >= confidenceThreshold) {
    nextReceipt.merchant = verification.merchant.value;
  }

  if (verification.transactionDate.value && verification.transactionDate.confidence >= confidenceThreshold) {
    const parsedDate = parseReceiptDateText(verification.transactionDate.sourceText ?? verification.transactionDate.value);

    if (parsedDate.isoDate) {
      nextReceipt.transactionDate = parsedDate.isoDate;
      nextReceipt.dateDebug = [...(nextReceipt.dateDebug ?? []), parsedDate.debug];
    } else {
      const fallbackDate = parseReceiptDateText(verification.transactionDate.value);
      if (fallbackDate.isoDate) {
        nextReceipt.transactionDate = fallbackDate.isoDate;
        nextReceipt.dateDebug = [...(nextReceipt.dateDebug ?? []), fallbackDate.debug];
      }
    }
  }

  if (
    typeof verification.totalAmount.value === "number" &&
    verification.totalAmount.value > 0 &&
    verification.totalAmount.confidence >= confidenceThreshold
  ) {
    nextReceipt.totalAmount = verification.totalAmount.value;
  }

  const verifiedItems = verification.items.filter((item) => item.name.trim() && item.confidence >= confidenceThreshold);
  if (verifiedItems.length > 0) {
    nextReceipt.items = verifiedItems.map<ParsedReceiptItem>((item) => ({
      name: item.name,
      quantity: item.quantity ?? undefined,
      unitPrice: item.unitPrice ?? undefined,
      totalPrice: item.totalPrice ?? undefined
    }));
  }

  if (nextReceipt.fieldConfidences) {
    const confidenceValues = Object.values(nextReceipt.fieldConfidences).filter(
      (value): value is number => typeof value === "number"
    );
    nextReceipt.confidence = confidenceValues.some((value) => value < confidenceThreshold) ? "low" : "high";
  }

  return nextReceipt;
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
