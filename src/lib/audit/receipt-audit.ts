import type { ParsedReceipt } from "@/lib/parser/receipt-parser";
import { parseIndonesianAmount } from "@/lib/parser/receipt-parser";

export type AuditField = {
  value: string | number | null;
  sourceText?: string | null;
  reason: string;
  confidence: number;
};

export type AuditCandidate = {
  field: "merchant" | "transactionDate" | "totalAmount" | "category" | "discount" | "shipping" | "item";
  value: string | number | null;
  sourceText: string;
  status: "accepted" | "rejected" | "warning";
  reason: string;
};

export type ReceiptAudit = {
  summary: string;
  selectedFields: {
    merchant?: AuditField;
    transactionDate?: AuditField;
    totalAmount?: AuditField;
    category?: AuditField;
  };
  acceptedCandidates: AuditCandidate[];
  rejectedCandidates: AuditCandidate[];
  warnings: string[];
  confidence: "high" | "medium" | "low";
};

type AuditInput = {
  rawText: string;
  parsedReceipt: ParsedReceipt;
};

type ReceiptLine = {
  raw: string;
  normalized: string;
  amounts: number[];
};

const ecommerceSignals = [
  "SHOPEE",
  "FAKTUR PESANAN",
  "NAMA PENJUAL",
  "NAMA PEMBELI",
  "RINCIAN PESANAN",
  "TOTAL PEMBAYARAN",
  "DISKON VOUCHER SHOPEE"
];

const finalTotalTerms = ["TOTAL PEMBAYARAN", "PEMBAYARAN", "GRAND TOTAL", "TOTAL BAYAR", "JUMLAH BAYAR", "TOTAL BELANJA"];
const quantityTerms = ["TOTAL KUANTITAS", "KUANTITAS"];
const discountTerms = ["DISKON", "VOUCHER", "HEMAT", "POTONGAN", "PROMO"];
const shippingTerms = ["SUBTOTAL PENGIRIMAN", "PENGIRIMAN", "ONGKIR", "SHIPPING", "JASA KIRIM"];
const serviceFeeTerms = ["BIAYA LAYANAN", "SERVICE FEE"];
const taxTerms = ["PPN", "PAJAK"];
const metadataTerms = ["NOMOR", "NO.", "NO:", "MEMBER", "TELP", "TELEPON", "WHATSAPP", "NPWP", "NWP"];

export function generateReceiptAudit({ rawText, parsedReceipt }: AuditInput): ReceiptAudit {
  const lines = getReceiptLines(rawText);
  const isEcommerce = isEcommerceReceipt(lines);
  const acceptedCandidates = buildAcceptedCandidates(lines, parsedReceipt);
  const rejectedCandidates = buildRejectedCandidates(lines, parsedReceipt, isEcommerce);
  const warnings = buildAuditWarnings(parsedReceipt, acceptedCandidates, rejectedCandidates);
  const selectedFields = buildSelectedFields(lines, parsedReceipt, acceptedCandidates, isEcommerce);
  const confidence = getAuditConfidence(parsedReceipt, selectedFields, acceptedCandidates, rejectedCandidates, warnings);
  const summary = buildSummary(parsedReceipt, acceptedCandidates, rejectedCandidates, confidence, isEcommerce);
  const auditWarnings = appendConfidenceWarnings(warnings, confidence, rejectedCandidates);

  if (process.env.NODE_ENV === "development") {
    const selectedTotal = selectedFields.totalAmount;
    console.debug("[Audit] selected total source", {
      sourceText: selectedTotal?.sourceText,
      reason: selectedTotal?.reason
    });
    console.debug("[Audit] rejected total candidates", rejectedCandidates.filter((candidate) => candidate.field === "totalAmount"));
    console.debug("[Audit] audit confidence", confidence);
    console.debug("[Audit] audit warnings", auditWarnings);
  }

  return {
    summary,
    selectedFields,
    acceptedCandidates,
    rejectedCandidates,
    warnings: auditWarnings,
    confidence
  };
}

function buildSelectedFields(
  lines: ReceiptLine[],
  parsedReceipt: ParsedReceipt,
  acceptedCandidates: AuditCandidate[],
  isEcommerce: boolean
): ReceiptAudit["selectedFields"] {
  const selectedTotal = acceptedCandidates.find((candidate) => candidate.field === "totalAmount");
  const merchantSource = findMerchantSource(lines, parsedReceipt, isEcommerce);
  const dateSource = findSelectedDateSource(parsedReceipt);

  return {
    merchant: parsedReceipt.merchant
      ? {
          value: parsedReceipt.merchant,
          sourceText: merchantSource,
          reason: isEcommerce && merchantSource?.toUpperCase().includes("NAMA PENJUAL")
            ? "Merchant dipilih dari Nama Penjual, bukan nama marketplace."
            : "Merchant dipilih dari baris identitas toko yang paling jelas.",
          confidence: parsedReceipt.fieldConfidences?.merchant ?? getCategoryLikeConfidence(Boolean(parsedReceipt.merchant))
        }
      : undefined,
    transactionDate: parsedReceipt.transactionDate
      ? {
          value: parsedReceipt.transactionDate,
          sourceText: dateSource,
          reason: "Tanggal dipilih dari baris tanggal transaksi dan tanggal non-transaksi diabaikan.",
          confidence: parsedReceipt.fieldConfidences?.transactionDate ?? 0.85
        }
      : undefined,
    totalAmount: parsedReceipt.totalAmount !== undefined
      ? {
          value: parsedReceipt.totalAmount,
          sourceText: selectedTotal?.sourceText ?? findSelectedTotalLine(lines, parsedReceipt.totalAmount)?.raw ?? null,
          reason: selectedTotal?.reason ?? getSelectedTotalReason(findSelectedTotalLine(lines, parsedReceipt.totalAmount), isEcommerce),
          confidence: parsedReceipt.fieldConfidences?.totalAmount ?? (selectedTotal ? 0.9 : 0.65)
        }
      : undefined,
    category: parsedReceipt.category
      ? {
          value: parsedReceipt.category,
          sourceText: parsedReceipt.merchant ?? null,
          reason: parsedReceipt.categoryReason ?? "Kategori dipilih dari merchant dan item yang terbaca.",
          confidence: parsedReceipt.categoryConfidence ?? 0.4
        }
      : undefined
  };
}

function buildAcceptedCandidates(lines: ReceiptLine[], parsedReceipt: ParsedReceipt) {
  const candidates: AuditCandidate[] = [];

  for (const candidate of parsedReceipt.totalCandidates ?? []) {
    if (!candidate.isSelected) {
      continue;
    }

    candidates.push({
      field: "totalAmount",
      value: candidate.amount,
      sourceText: candidate.sourceText,
      status: "accepted",
      reason: getAcceptedTotalReason(candidate.sourceText, candidate.reason)
    });
  }

  const selectedTotalLine = parsedReceipt.totalAmount !== undefined ? findSelectedTotalLine(lines, parsedReceipt.totalAmount) : undefined;
  if (parsedReceipt.totalAmount !== undefined && selectedTotalLine && !candidates.some((candidate) => candidate.value === parsedReceipt.totalAmount)) {
    candidates.push({
      field: "totalAmount",
      value: parsedReceipt.totalAmount,
      sourceText: selectedTotalLine.raw,
      status: "accepted",
      reason: getSelectedTotalReason(selectedTotalLine, false)
    });
  }

  const subtotalPaymentMatch = findSubtotalPaymentMatch(lines, parsedReceipt.totalAmount);
  if (subtotalPaymentMatch) {
    for (const line of subtotalPaymentMatch) {
      if (!candidates.some((candidate) => candidate.sourceText === line.raw)) {
        candidates.push({
          field: "totalAmount",
          value: parsedReceipt.totalAmount ?? null,
          sourceText: line.raw,
          status: "accepted",
          reason: "Nilai ini cocok dengan subtotal dan pembayaran, sehingga total lebih yakin."
        });
      }
    }
  }

  return dedupeCandidates(candidates);
}

function buildRejectedCandidates(lines: ReceiptLine[], parsedReceipt: ParsedReceipt, isEcommerce: boolean) {
  const candidates: AuditCandidate[] = [];

  for (const candidate of parsedReceipt.totalCandidates ?? []) {
    if (candidate.isSelected) {
      continue;
    }

    const field = getCandidateField(candidate.sourceText);
    candidates.push({
      field,
      value: candidate.amount,
      sourceText: candidate.sourceText,
      status: "rejected",
      reason: getRejectedReason(candidate.sourceText, candidate.reason, isEcommerce)
    });
  }

  for (const line of lines) {
    const rejectedReason = getRejectedLineReason(line, isEcommerce);
    if (!rejectedReason) {
      continue;
    }

    const field = getCandidateField(line.raw);
    for (const amount of line.amounts) {
      if (parsedReceipt.totalAmount !== undefined && amount === parsedReceipt.totalAmount && field === "totalAmount") {
        continue;
      }

      candidates.push({
        field,
        value: amount,
        sourceText: line.raw,
        status: "rejected",
        reason: rejectedReason
      });
    }
  }

  for (const item of parsedReceipt.items ?? []) {
    const itemLine = findItemLine(lines, item.name);
    for (const amount of [item.unitPrice, item.totalPrice]) {
      if (typeof amount !== "number" || amount === parsedReceipt.totalAmount) {
        continue;
      }

      candidates.push({
        field: "item",
        value: amount,
        sourceText: itemLine?.raw ?? item.name,
        status: "rejected",
        reason: amount === item.unitPrice
          ? "Nilai ini tidak dipakai sebagai total karena berada di baris item sebagai harga satuan."
          : "Nilai ini tidak dipakai sebagai total karena berada di baris item."
      });
    }
  }

  for (const debug of parsedReceipt.dateDebug ?? []) {
    if (!debug.rejectionReason || !debug.rawDateText) {
      continue;
    }

    candidates.push({
      field: "transactionDate",
      value: null,
      sourceText: debug.rawDateText,
      status: "rejected",
      reason: debug.rejectionReason
    });
  }

  if (isEcommerce) {
    const platformLine = lines.find((line) => line.normalized.includes("PT SHOPEE INTERNATIONAL INDONESIA"));
    if (platformLine) {
      candidates.push({
        field: "merchant",
        value: "PT Shopee International Indonesia",
        sourceText: platformLine.raw,
        status: "rejected",
        reason: "Nama marketplace tidak dipakai sebagai merchant karena penjual diambil dari Nama Penjual."
      });
    }
  }

  return dedupeCandidates(candidates);
}

function buildAuditWarnings(
  parsedReceipt: ParsedReceipt,
  acceptedCandidates: AuditCandidate[],
  rejectedCandidates: AuditCandidate[]
) {
  const warnings = [...(parsedReceipt.warnings ?? [])];
  const hasSelectedTotal = acceptedCandidates.some((candidate) => candidate.field === "totalAmount");
  const rejectedTotals = rejectedCandidates.filter((candidate) => candidate.field === "totalAmount" && !isMetadataRejection(candidate));

  if (!hasSelectedTotal && parsedReceipt.totalAmount !== undefined) {
    warnings.push("Total transaksi kurang yakin. Mohon periksa kembali.");
  }

  if (rejectedTotals.length > 1) {
    warnings.push("AI menemukan beberapa kandidat total. Pastikan total yang dipilih sudah benar.");
  }

  return Array.from(new Set(warnings));
}

function appendConfidenceWarnings(warnings: string[], confidence: ReceiptAudit["confidence"], rejectedCandidates: AuditCandidate[]) {
  const nextWarnings = [...warnings];

  if (confidence !== "high") {
    nextWarnings.push("Hasil struk perlu diperiksa kembali.");
  }

  if (confidence === "low") {
    nextWarnings.push("Total transaksi kurang yakin. Mohon periksa kembali.");
  }

  if (rejectedCandidates.filter((candidate) => candidate.field === "totalAmount" && !isMetadataRejection(candidate)).length > 1) {
    nextWarnings.push("AI menemukan beberapa kandidat total. Pastikan total yang dipilih sudah benar.");
  }

  return Array.from(new Set(nextWarnings));
}

function getAuditConfidence(
  parsedReceipt: ParsedReceipt,
  selectedFields: ReceiptAudit["selectedFields"],
  acceptedCandidates: AuditCandidate[],
  rejectedCandidates: AuditCandidate[],
  warnings: string[]
): ReceiptAudit["confidence"] {
  if (!selectedFields.totalAmount || !selectedFields.transactionDate || !selectedFields.category) {
    return "low";
  }

  const fieldConfidences = [
    selectedFields.merchant?.confidence,
    selectedFields.transactionDate?.confidence,
    selectedFields.totalAmount?.confidence,
    selectedFields.category?.confidence
  ].filter((value): value is number => typeof value === "number");

  if (fieldConfidences.some((value) => value < 0.6) || parsedReceipt.confidence === "low") {
    return "low";
  }

  const selectedTotalSource = acceptedCandidates.find((candidate) => candidate.field === "totalAmount")?.sourceText ?? "";
  const hasStrongTotal = hasAnyTerm(selectedTotalSource, finalTotalTerms) || Boolean(findSubtotalPaymentMatchFromCandidates(acceptedCandidates));
  const hasManyRejectedTotals = rejectedCandidates.filter((candidate) => candidate.field === "totalAmount" && !isMetadataRejection(candidate)).length > 2;

  if (fieldConfidences.some((value) => value < 0.8) || warnings.length > 0 || hasManyRejectedTotals || !hasStrongTotal) {
    return "medium";
  }

  return "high";
}

function buildSummary(
  parsedReceipt: ParsedReceipt,
  acceptedCandidates: AuditCandidate[],
  rejectedCandidates: AuditCandidate[],
  confidence: ReceiptAudit["confidence"],
  isEcommerce: boolean
) {
  const totalCandidate = acceptedCandidates.find((candidate) => candidate.field === "totalAmount");
  const totalPart = totalCandidate
    ? `Total transaksi dipilih dari '${totalCandidate.sourceText}'.`
    : "Total transaksi belum memiliki sumber yang kuat.";
  const rejectedTotalExplanations = rejectedCandidates
    .filter((candidate) => ["totalAmount", "discount", "shipping", "item"].includes(candidate.field) && !isMetadataRejection(candidate))
    .slice(0, 3)
    .map((candidate) => `${candidate.sourceText} tidak dipakai karena ${lowercaseFirst(candidate.reason)}`);
  const subtotalPaymentPart = findSubtotalPaymentMatchFromCandidates(acceptedCandidates)
    ? "Nilai ini cocok dengan subtotal dan pembayaran."
    : "";
  const categoryPart = parsedReceipt.category
    ? `Kategori dipilih sebagai ${parsedReceipt.category}.`
    : "Kategori belum jelas.";
  const confidencePart = confidence === "high"
    ? "Kepercayaan audit tinggi."
    : confidence === "medium"
      ? "Kepercayaan audit sedang, tetap periksa hasil sebelum menyimpan."
      : "Kepercayaan audit rendah, hasil perlu diperiksa kembali.";
  const ecommercePart = isEcommerce
    ? "Untuk struk e-commerce, subtotal produk, pengiriman, biaya layanan, dan diskon dijelaskan terpisah dari total pembayaran akhir."
    : "";

  return [totalPart, subtotalPaymentPart, ...rejectedTotalExplanations, categoryPart, ecommercePart, confidencePart]
    .filter(Boolean)
    .join(" ");
}

function getAcceptedTotalReason(sourceText: string, fallbackReason: string) {
  const normalized = normalizeForMatching(sourceText);

  if (normalized.includes("TOTAL PEMBAYARAN")) {
    return "Dipilih karena baris Total Pembayaran biasanya menunjukkan nominal akhir yang dibayar.";
  }

  if (normalized.includes("PEMBAYARAN")) {
    return "Dipilih dari baris pembayaran akhir.";
  }

  if (normalized.includes("GRAND TOTAL") || normalized.includes("TOTAL BAYAR") || normalized.includes("JUMLAH BAYAR")) {
    return "Dipilih dari baris total akhir struk.";
  }

  return fallbackReason || "Dipilih sebagai kandidat total transaksi terbaik.";
}

function getSelectedTotalReason(line: ReceiptLine | undefined, isEcommerce: boolean) {
  if (!line) {
    return "Total dipilih dari hasil ekstraksi yang sudah divalidasi.";
  }

  if (isEcommerce && line.normalized.includes("TOTAL PEMBAYARAN")) {
    return "Dipilih karena Total Pembayaran adalah total akhir pada struk e-commerce.";
  }

  if (line.normalized.includes("PEMBAYARAN")) {
    return "Dipilih dari baris pembayaran karena menunjukkan nominal yang dibayar.";
  }

  if (line.normalized.includes("SUBTOTAL")) {
    return "Dipilih dari subtotal karena tidak ada total pembayaran yang lebih kuat.";
  }

  return "Dipilih dari baris total yang paling kuat.";
}

function getRejectedReason(sourceText: string, fallbackReason: string, isEcommerce: boolean) {
  const line = { raw: sourceText, normalized: normalizeForMatching(sourceText), amounts: extractAmounts(sourceText) };

  return getRejectedLineReason(line, isEcommerce) ?? fallbackReason ?? "Tidak dipakai sebagai total akhir.";
}

function getRejectedLineReason(line: ReceiptLine, isEcommerce: boolean) {
  if (hasAnyTerm(line.raw, quantityTerms)) {
    return "Baris ini menunjukkan jumlah produk, bukan nominal pembayaran.";
  }

  if (isEcommerce && (line.normalized.includes("SUBTOTAL PESANAN") || line.normalized.includes("HARGA PRODUK"))) {
    return "Subtotal produk tidak dipakai sebagai total akhir karena Total Pembayaran tersedia.";
  }

  if (line.normalized.includes("SUBTOTAL PENGIRIMAN") || hasAnyTerm(line.raw, shippingTerms)) {
    return "Biaya pengiriman dijelaskan terpisah dan bukan total transaksi akhir.";
  }

  if (hasAnyTerm(line.raw, serviceFeeTerms)) {
    return "Biaya layanan adalah komponen tambahan, bukan total transaksi akhir.";
  }

  if (hasAnyTerm(line.raw, discountTerms)) {
    return "Diskon atau voucher mengurangi pembayaran dan bukan total akhir.";
  }

  if (line.normalized.includes("KEMBALI")) {
    return "Kembalian bukan total transaksi.";
  }

  if (hasAnyTerm(line.raw, taxTerms)) {
    return "PPN atau pajak bukan total transaksi akhir.";
  }

  if (hasAnyTerm(line.raw, metadataTerms) || hasPhoneLikeNumber(line.raw) || hasLongMetadataNumber(line.raw)) {
    return "Nomor telepon, member, pesanan, atau pajak bukan nominal transaksi.";
  }

  return undefined;
}

function getCandidateField(sourceText: string): AuditCandidate["field"] {
  if (hasAnyTerm(sourceText, discountTerms)) {
    return "discount";
  }

  if (hasAnyTerm(sourceText, shippingTerms) || hasAnyTerm(sourceText, serviceFeeTerms)) {
    return "shipping";
  }

  return "totalAmount";
}

function findMerchantSource(lines: ReceiptLine[], parsedReceipt: ParsedReceipt, isEcommerce: boolean) {
  if (!parsedReceipt.merchant) {
    return null;
  }

  if (isEcommerce) {
    const sellerLine = lines.find((line) => line.normalized.includes("NAMA PENJUAL"));
    if (sellerLine) {
      return sellerLine.raw;
    }
  }

  return lines.find((line) => line.raw.includes(parsedReceipt.merchant ?? ""))?.raw ?? parsedReceipt.merchant;
}

function findSelectedDateSource(parsedReceipt: ParsedReceipt) {
  const selectedDebug = parsedReceipt.dateDebug?.find((debug) => debug.selectedIsoDate === parsedReceipt.transactionDate);

  return selectedDebug?.rawDateText ?? parsedReceipt.transactionDate ?? null;
}

function findSelectedTotalLine(lines: ReceiptLine[], totalAmount: number | undefined) {
  if (typeof totalAmount !== "number") {
    return undefined;
  }

  const matchingLines = lines.filter((line) => line.amounts.includes(totalAmount));

  return (
    matchingLines.find((line) => line.normalized.includes("TOTAL PEMBAYARAN")) ??
    matchingLines.find((line) => line.normalized.includes("PEMBAYARAN")) ??
    matchingLines.find((line) => hasAnyTerm(line.raw, finalTotalTerms)) ??
    matchingLines.find((line) => line.normalized.includes("SUBTOTAL")) ??
    matchingLines[0]
  );
}

function findSubtotalPaymentMatch(lines: ReceiptLine[], totalAmount: number | undefined) {
  if (typeof totalAmount !== "number") {
    return undefined;
  }

  const subtotal = lines.find((line) => line.amounts.includes(totalAmount) && line.normalized.includes("SUBTOTAL"));
  const payment = lines.find((line) => line.amounts.includes(totalAmount) && line.normalized.includes("PEMBAYARAN"));

  return subtotal && payment ? [payment, subtotal] : undefined;
}

function findSubtotalPaymentMatchFromCandidates(candidates: AuditCandidate[]) {
  return (
    candidates.some((candidate) => normalizeForMatching(candidate.sourceText).includes("SUBTOTAL")) &&
    candidates.some((candidate) => normalizeForMatching(candidate.sourceText).includes("PEMBAYARAN"))
  );
}

function isMetadataRejection(candidate: AuditCandidate) {
  return /Nomor telepon|member|pesanan|pajak/i.test(candidate.reason);
}

function findItemLine(lines: ReceiptLine[], itemName: string) {
  const normalizedItem = normalizeForMatching(itemName).slice(0, 24);

  return lines.find((line) => normalizedItem && line.normalized.includes(normalizedItem));
}

function getReceiptLines(rawText: string): ReceiptLine[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/[|]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((line) => ({
      raw: line,
      normalized: normalizeForMatching(line),
      amounts: extractAmounts(line)
    }));
}

function extractAmounts(line: string) {
  const matches = line.match(/-?\s*(?:Rp\s*)?\d{1,3}(?:[.,]\d{3})+(?:,\d{2})?|-?\s*(?:Rp\s*)?\d+/gi) ?? [];

  return matches
    .map((match) => parseIndonesianAmount(match.replace(/^-\s*rp\s*/i, "-").replace(/^rp\s*/i, "")))
    .filter((amount): amount is number => typeof amount === "number" && Number.isFinite(amount));
}

function isEcommerceReceipt(lines: ReceiptLine[]) {
  const text = lines.map((line) => line.normalized).join(" ");
  const signalCount = ecommerceSignals.filter((signal) => text.includes(signal)).length;

  return signalCount >= 2 || text.includes("TOTAL PEMBAYARAN");
}

function hasAnyTerm(value: string, terms: string[]) {
  const normalized = normalizeForMatching(value);

  return terms.some((term) => normalized.includes(term));
}

function normalizeForMatching(value: string) {
  return value
    .toUpperCase()
    .replace(/\bSUB\s+TOTAL\b/g, "SUBTOTAL")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPhoneLikeNumber(value: string) {
  const digits = value.replace(/\D/g, "");

  return digits.length >= 10 && (digits.startsWith("0") || digits.startsWith("62"));
}

function hasLongMetadataNumber(value: string) {
  return value.replace(/\D/g, "").length >= 12 && hasAnyTerm(value, metadataTerms);
}

function getCategoryLikeConfidence(hasValue: boolean) {
  return hasValue ? 0.8 : 0.2;
}

function dedupeCandidates(candidates: AuditCandidate[]) {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = `${candidate.field}:${candidate.value ?? ""}:${candidate.sourceText}:${candidate.reason}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function lowercaseFirst(value: string) {
  return value ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : value;
}
