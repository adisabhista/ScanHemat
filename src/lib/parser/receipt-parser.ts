import { classifyReceiptCategory, type TransactionCategoryName } from "@/lib/categories/category-classifier";
import { isNonTransactionDateLine, parseReceiptDateText, type ReceiptDateDebug } from "@/lib/parser/receipt-date-parser";
import type { ReceiptAudit } from "@/lib/audit/receipt-audit";

export type ParsedReceiptItem = {
  name: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
};

export type ReceiptTotalCandidate = {
  amount: number;
  sourceText: string;
  isSelected: boolean;
  reason: string;
};

export type ParsedReceipt = {
  merchant?: string;
  transactionDate?: string;
  totalAmount?: number;
  totalCandidates?: ReceiptTotalCandidate[];
  items: ParsedReceiptItem[];
  confidence?: "high" | "low";
  audit?: ReceiptAudit;
  fieldConfidences?: {
    merchant?: number;
    transactionDate?: number;
    totalAmount?: number;
  };
  warnings?: string[];
  visionCorrections?: {
    field: "merchant" | "transactionDate" | "totalAmount" | "items" | "category";
    oldValue: string | number | null;
    newValue: string | number | null;
    reason: string;
  }[];
  category?: TransactionCategoryName;
  categoryId?: string;
  categoryConfidence?: number;
  categoryReason?: string | null;
  categorySource?: "gemini" | "fallback" | "default";
  dateDebug?: ReceiptDateDebug[];
};

type AmountToken = {
  raw: string;
  amount: number;
};

type NumericColumn = {
  raw: string;
  amount: number;
};

const merchantRejectTerms = [
  "STRUK",
  "NOTA",
  "RECEIPT",
  "COPY",
  "NPWP",
  "NWP",
  "PAJAK",
  "PPN",
  "TANGGAL PENGUKUHAN",
  "PENGUKUHAN",
  "ALAMAT",
  "JL.",
  "JALAN",
  "KEL.",
  "KEC.",
  "TELP",
  "TELEPON",
  "PHONE",
  "WHATSAPP",
  "EMAIL",
  "WWW",
  "HTTP",
  "MEMBER",
  "NOMOR",
  "NO."
];

const totalKeywords = [
  "TOTAL PEMBAYARAN",
  "JUMLAH PEMBAYARAN",
  "GRAND TOTAL",
  "TOTAL BELANJA",
  "TOTAL BAYAR",
  "JUMLAH BAYAR",
  "PEMBAYARAN",
  "TOTAL",
  "SUB TOTAL",
  "SUBTOTAL",
  "JUMLAH",
  "BAYAR"
];

const totalRejectTerms = [
  "TOTAL KUANTITAS",
  "KUANTITAS",
  "PRODUK",
  "HARGA PRODUK",
  "SUBTOTAL PESANAN",
  "SUBTOTAL PENGIRIMAN",
  "BIAYA LAYANAN",
  "TOTAL DISKON PENGIRIMAN",
  "DISKON VOUCHER TOKO",
  "DISKON VOUCHER SHOPEE",
  "TOTAL ITEM",
  "KEMBALI",
  "CHANGE",
  "NOMOR",
  "NO.",
  "NO:",
  "MEMBER",
  "TELP",
  "TELEPON",
  "WHATSAPP",
  "NPWP",
  "NWP",
  "DISKON",
  "DISC",
  "HEMAT",
  "POTONGAN",
  "PROMO",
  "PPN",
  "PAJAK",
  "TUNAI",
  "CASH" // we only reject TUNAI/CASH if it's the exact keyword, but we'll handle this in extraction
];

const itemStopTerms = [
  "SUBTOTAL",
  "SUB TOTAL",
  "GRAND TOTAL",
  "TOTAL BELANJA",
  "TOTAL ITEM",
  "TOTAL",
  "JUMLAH",
  "PEMBAYARAN",
  "BAYAR",
  "TUNAI",
  "QRIS",
  "DEBIT",
  "KARTU",
  "KEMBALI",
  "PAJAK",
  "PPN",
  "SERVICE",
  "LAYANAN",
  "DISKON",
  "DISC",
  "HEMAT",
  "POTONGAN",
  "PROMO",
  "MEMBER",
  "NOMOR",
  "NO.",
  "NO:",
  "TERIMA KASIH",
  "SARAN",
  "TELP",
  "TELEPON",
  "WHATSAPP",
  "EMAIL",
  "WWW",
  "HTTP"
];

const itemRejectTerms = [
  ...itemStopTerms,
  "NPWP",
  "NWP",
  "TANGGAL PENGUKUHAN",
  "PENGUKUHAN",
  "KEL.",
  "KEC.",
  "JL.",
  "JALAN",
  "ALAMAT",
  "FAKTUR",
  "TRANSAKSI",
  "REF",
  "AUTH",
  "TRACE"
];

const discountTerms = ["DISKON", "DISC", "HEMAT", "POTONGAN", "PROMO"];
const ecommerceSignals = [
  "SHOPEE",
  "FAKTUR PESANAN",
  "NO. PESANAN",
  "NAMA PENJUAL",
  "NAMA PEMBELI",
  "RINCIAN PESANAN",
  "TOTAL PEMBAYARAN",
  "DISKON VOUCHER SHOPEE"
];
const ecommercePlatformMerchants = ["PT SHOPEE INTERNATIONAL INDONESIA", "SHOPEE"];
const ecommerceTotalPriority = ["TOTAL PEMBAYARAN", "TOTAL BAYAR", "JUMLAH PEMBAYARAN", "GRAND TOTAL"];
const ecommerceSubtotalTerms = ["SUBTOTAL PESANAN", "SUBTOTAL", "HARGA PRODUK"];
const ecommerceShippingTerms = ["PENGIRIMAN", "JASA KIRIM", "ONGKIR", "SHIPPING"];
const ecommerceServiceFeeTerms = ["BIAYA LAYANAN", "SERVICE FEE", "LAYANAN"];
const ecommerceQuantityTerms = ["TOTAL KUANTITAS", "KUANTITAS", "PRODUK"];

function cleanLines(rawText: string) {
  return rawText
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/[|]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
}

function normalizeForMatching(line: string) {
  return line
    .toUpperCase()
    .replace(/\bMARGA\b/g, "HARGA")
    .replace(/\bDESKRIPST\b/g, "DESKRIPSI")
    .replace(/\bDESCRIPSI\b/g, "DESKRIPSI")
    .replace(/\bSUB\s+TOTAL\b/g, "SUBTOTAL")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAnyTerm(line: string, terms: string[]) {
  const normalized = normalizeForMatching(line);
  return terms.some((term) => normalized.includes(term));
}

function countDigits(value: string) {
  return (value.match(/\d/g) ?? []).length;
}

function countLetters(value: string) {
  return (value.match(/[A-Za-z]/g) ?? []).length;
}

function isLongUnseparatedNumber(value: string) {
  const stripped = value.replace(/^rp\s*/i, "").replace(/[^\d.,-]/g, "");
  const digitCount = countDigits(stripped);
  const hasSeparator = /[.,]/.test(stripped);

  return !hasSeparator && digitCount > 8;
}

function isPhoneLikeNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && (digits.startsWith("0") || digits.startsWith("62"));
}

function isNpwpLikeNumber(value: string) {
  return value.replace(/\D/g, "").length >= 15;
}

export function parseIndonesianAmount(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, "");

  if (!cleaned || cleaned === "-") {
    return undefined;
  }

  const isNegative = cleaned.startsWith("-");
  const unsigned = cleaned.replace(/^-/, "");
  const normalized =
    unsigned.includes(".")
      ? unsigned.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")
      : unsigned.replace(/,(?=\d{3}$)/, "").replace(",", ".");
  const parsed = Number.parseFloat(`${isNegative ? "-" : ""}${normalized}`);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseAmountToken(token: string) {
  const withoutCurrency = token
    .trim()
    .replace(/^-\s*rp\s*/i, "-")
    .replace(/^rp\s*/i, "");

  if (/[A-Za-z]/.test(withoutCurrency)) {
    return undefined;
  }

  if (isLongUnseparatedNumber(withoutCurrency) || isPhoneLikeNumber(withoutCurrency) || isNpwpLikeNumber(withoutCurrency)) {
    return undefined;
  }

  const cleaned = withoutCurrency.replace(/[^\d,.-]/g, "");

  if (!/^-?\d/.test(cleaned)) {
    return undefined;
  }

  const amount = parseIndonesianAmount(cleaned);

  return typeof amount === "number" ? amount : undefined;
}

function extractAmountTokens(line: string): AmountToken[] {
  const matches = line.match(/-?\s*(?:Rp\s*)?\d{1,3}(?:[.,]\d{3})+(?:,\d{2})?|-?\s*(?:Rp\s*)?\d+/gi) ?? [];

  return matches
    .map((match) => ({ raw: match, amount: parseAmountToken(match) }))
    .filter((match): match is AmountToken => typeof match.amount === "number");
}

function extractAmounts(line: string) {
  return extractAmountTokens(line).map((token) => token.amount);
}

function isEcommerceReceipt(lines: string[]) {
  const text = normalizeForMatching(lines.join(" "));
  const matchCount = ecommerceSignals.filter((signal) => text.includes(signal)).length;

  return matchCount >= 2 || text.includes("TOTAL PEMBAYARAN");
}

function isMostlyNumeric(line: string) {
  const letters = countLetters(line);
  const digits = countDigits(line);

  return digits > 0 && digits > letters * 2;
}

function isMetadataLine(line: string) {
  const letters = countLetters(line);

  return hasAnyTerm(line, itemRejectTerms) || (letters < 6 && (isPhoneLikeNumber(line) || isNpwpLikeNumber(line)));
}

function isDiscountLine(line: string) {
  return hasAnyTerm(line, discountTerms);
}

const merchantPrefixes = ["PT", "CV", "UD", "TBK"];
const knownMerchants = [
  "INDO", "MART", "SUPER", "ALFA", "HYPER", "TRANS", "GUARDIAN", "WATSONS", "KFC", "MCDONALD", "STARBUCKS"
];

function isLikelyMerchantLine(line: string) {
  const normalized = normalizeForMatching(line);

  return (
    line.length >= 3 &&
    countLetters(line) >= 2 &&
    !isMostlyNumeric(line) &&
    !/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/.test(line) &&
    !merchantRejectTerms.some((term) => normalized.includes(term))
  );
}

function extractMerchant(lines: string[]): { merchant?: string; warnings: string[] } {
  const warnings: string[] = [];
  const sellerLine = lines.find((line) => normalizeForMatching(line).includes("NAMA PENJUAL"));

  if (sellerLine) {
    const merchant = sellerLine
      .replace(/^.*?NAMA\s+PENJUAL\s*:?\s*/i, "")
      .trim();

    if (merchant) {
      return { merchant, warnings };
    }
  }

  const candidateLines: string[] = [];
  
  // Collect the first few likely merchant lines from the top of the receipt
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const line = lines[i];
    if (isLikelyMerchantLine(line)) {
      candidateLines.push(line);
    } else if (candidateLines.length > 0 && (hasAnyTerm(line, merchantRejectTerms) || isMostlyNumeric(line))) {
      // Stop collecting if we hit a definite non-merchant line after finding some candidates
      break;
    }
  }

  if (candidateLines.length === 0) {
    return { merchant: undefined, warnings };
  }

  // If we have multiple lines, try to combine them if they look like a split name
  let merchant = candidateLines[0];
  const firstNorm = normalizeForMatching(merchant);
  
  // Prefer the first line if it's already a full name or contains known prefixes
  if (candidateLines.length > 1 && !firstNorm.includes(" ") && firstNorm.length < 10) {
    // Combine first two lines if the first is short (e.g. "SUPER" "INDO")
    merchant = `${candidateLines[0]} ${candidateLines[1]}`;
  } else if (candidateLines.length > 1 && merchantPrefixes.some(p => firstNorm === p)) {
    // Combine "PT" "LION SUPER INDO"
    merchant = `${candidateLines[0]} ${candidateLines[1]}`;
  }

  if (ecommercePlatformMerchants.includes(normalizeForMatching(merchant))) {
    warnings.push("Merchant marketplace diabaikan karena bukan nama penjual.");
    return { merchant: undefined, warnings };
  }

  if (merchant.split(" ").length === 1 && knownMerchants.every(m => !normalizeForMatching(merchant).includes(m))) {
    warnings.push("Merchant terdeteksi hanya 1 kata, periksa kembali.");
  }

  return { merchant, warnings };
}

function extractDate(lines: string[]): { transactionDate?: string; warnings: string[]; dateDebug: ReceiptDateDebug[] } {
  const warnings: string[] = [];
  const dateDebug: ReceiptDateDebug[] = [];
  const debuggedLines = new Set<string>();

  for (const line of lines) {
    if (isNonTransactionDateLine(line) && /\d{1,4}[/-]\d{1,2}[/-]\d{1,4}/.test(line)) {
      dateDebug.push(parseReceiptDateText(line).debug);
      debuggedLines.add(line);
    }
  }
  
  // Prefer lines with time
  const timeLines = lines.filter(line => /\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(line));
  for (const line of timeLines) {
    const result = parseReceiptDateText(line);

    if (!debuggedLines.has(line)) {
      dateDebug.push(result.debug);
      debuggedLines.add(line);
    }

    if (result.isoDate) {
      return { transactionDate: result.isoDate, warnings, dateDebug };
    }
  }

  // Fallback to any line
  for (const line of lines) {
    if (timeLines.includes(line)) {
      continue;
    }

    const result = parseReceiptDateText(line);

    if (
      !debuggedLines.has(line) &&
      (result.isoDate || result.debug.detectedPattern || result.debug.rejectionReason !== "Tidak ada pola tanggal transaksi yang cocok.")
    ) {
      dateDebug.push(result.debug);
      debuggedLines.add(line);
    }

    if (result.isoDate) {
      return { transactionDate: result.isoDate, warnings, dateDebug };
    }
  }

  warnings.push("Tanggal transaksi tidak ditemukan atau berada di bagian yang diabaikan (misal: Tanggal Pengukuhan).");
  return { transactionDate: undefined, warnings, dateDebug };
}

function isTotalCandidateLine(line: string) {
  const normalized = normalizeForMatching(line);
  // Specifically allow TUNAI/CASH only if it's accompanied by TOTAL keywords, else reject
  if (totalRejectTerms.some((keyword) => normalized.includes(keyword) && keyword !== "TUNAI" && keyword !== "CASH")) {
    return false;
  }
  
  return totalKeywords.some((keyword) => normalized.includes(keyword));
}

function getEcommerceCandidateReason(line: string) {
  const normalized = normalizeForMatching(line);

  if (ecommerceQuantityTerms.some((term) => normalized.includes(term))) {
    return "Ditolak karena baris kuantitas, bukan total pembayaran.";
  }

  if (discountTerms.some((term) => normalized.includes(term))) {
    return "Ditolak karena baris diskon/voucher.";
  }

  if (ecommerceShippingTerms.some((term) => normalized.includes(term))) {
    return "Ditolak karena baris biaya pengiriman.";
  }

  if (ecommerceServiceFeeTerms.some((term) => normalized.includes(term))) {
    return "Ditolak karena baris biaya layanan.";
  }

  if (ecommerceSubtotalTerms.some((term) => normalized.includes(term))) {
    return "Ditolak karena subtotal/harga produk, bukan pembayaran akhir.";
  }

  const totalKeyword = ecommerceTotalPriority.find((keyword) => normalized.includes(keyword));
  if (totalKeyword) {
    return `Dipilih dari prioritas e-commerce: ${totalKeyword}.`;
  }

  return "Ditolak karena bukan prioritas total e-commerce.";
}

function getEcommerceTotalRank(line: string) {
  const normalized = normalizeForMatching(line);
  const index = ecommerceTotalPriority.findIndex((keyword) => normalized.includes(keyword));

  return index >= 0 ? index : Number.POSITIVE_INFINITY;
}

function isRejectedEcommerceTotalLine(line: string) {
  const normalized = normalizeForMatching(line);

  return (
    ecommerceQuantityTerms.some((term) => normalized.includes(term)) ||
    ecommerceSubtotalTerms.some((term) => normalized.includes(term)) ||
    ecommerceShippingTerms.some((term) => normalized.includes(term)) ||
    ecommerceServiceFeeTerms.some((term) => normalized.includes(term)) ||
    discountTerms.some((term) => normalized.includes(term))
  );
}

function getTotalKeywordRank(line: string) {
  const normalized = normalizeForMatching(line);
  const index = totalKeywords.findIndex((keyword) => normalized.includes(keyword));
  return index >= 0 ? index : Number.POSITIVE_INFINITY;
}

function extractEcommerceTotal(lines: string[]): { totalAmount?: number; warnings: string[]; totalCandidates: ReceiptTotalCandidate[] } {
  const warnings: string[] = [];
  const rawCandidates: Array<{ amount: number; line: string; rank: number; rejected: boolean; reason: string }> = [];

  for (const line of lines) {
    const amounts = extractAmounts(line);

    if (amounts.length === 0) {
      continue;
    }

    const normalized = normalizeForMatching(line);
    const isPriorityTotal = ecommerceTotalPriority.some((keyword) => normalized.includes(keyword));
    const isRejected = isRejectedEcommerceTotalLine(line);

    if (!isPriorityTotal && !isRejected) {
      continue;
    }

    rawCandidates.push({
      amount: amounts[amounts.length - 1],
      line,
      rank: getEcommerceTotalRank(line),
      rejected: isRejected || !isPriorityTotal,
      reason: getEcommerceCandidateReason(line)
    });
  }

  const selected = rawCandidates
    .filter((candidate) => !candidate.rejected && Number.isFinite(candidate.rank))
    .sort((first, second) => first.rank - second.rank)[0];

  if (!selected) {
    warnings.push("Total pembayaran e-commerce tidak ditemukan, kembali ke parser umum.");
    return { warnings, totalCandidates: [] };
  }

  return {
    totalAmount: selected.amount,
    warnings,
    totalCandidates: rawCandidates.map((candidate) => ({
      amount: candidate.amount,
      sourceText: candidate.line,
      isSelected: candidate === selected,
      reason: candidate === selected ? candidate.reason : candidate.reason
    }))
  };
}

function extractTotal(lines: string[], itemStartIndex: number | undefined, summaryStartIndex: number | undefined, isEcommerce: boolean): { totalAmount?: number; warnings: string[]; totalCandidates?: ReceiptTotalCandidate[] } {
  if (isEcommerce) {
    const ecommerceTotal = extractEcommerceTotal(lines);

    if (ecommerceTotal.totalAmount !== undefined) {
      return ecommerceTotal;
    }
  }

  const warnings: string[] = [];
  const candidates: { amount: number; rank: number; index: number; line: string }[] = [];

  // Start searching mainly from summary section or everywhere if boundaries are unclear
  const searchLines = lines.map((line, index) => ({ line, index }));

  for (const { line, index } of searchLines) {
    // If it's explicitly in the item section, avoid picking totals from there unless desperate
    if (itemStartIndex !== undefined && summaryStartIndex !== undefined) {
      if (index >= itemStartIndex && index < summaryStartIndex) {
         continue; // skip item lines entirely for total candidate search
      }
    }

    if (isTotalCandidateLine(line)) {
      const amounts = extractAmounts(line).filter((amount) => amount > 0);
      if (amounts.length > 0) {
        candidates.push({
          amount: amounts[amounts.length - 1],
          rank: getTotalKeywordRank(line),
          index,
          line
        });
      }
    }
  }

  if (candidates.length > 0) {
    // Special rule: if "Sub Total" and "Pembayaran" (or two different high-ranking lines) have the exact same amount, trust that amount.
    const amountCounts = new Map<number, number>();
    for (const c of candidates) {
      amountCounts.set(c.amount, (amountCounts.get(c.amount) || 0) + 1);
    }
    
    let bestAmount: number | undefined = undefined;
    let maxCount = 0;
    for (const [amt, count] of amountCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        bestAmount = amt;
      }
    }

    // If multiple lines agree on the same amount (like Sub Total and Pembayaran), use it
    if (maxCount >= 2 && bestAmount !== undefined) {
      return { totalAmount: bestAmount, warnings };
    }

    // Otherwise, pick the best rank
    candidates.sort((first, second) => first.rank - second.rank || second.index - first.index);
    return { totalAmount: candidates[0].amount, warnings };
  }

  warnings.push("Total transaksi diambil dari angka terbesar (akurasi rendah).");

  // Fallback: Max amount in the summary section or anywhere outside items
  const fallbackLines = lines.filter((line, index) => {
    if (isMetadataLine(line) || isDiscountLine(line)) return false;
    if (itemStartIndex !== undefined && summaryStartIndex !== undefined) {
      if (index >= itemStartIndex && index < summaryStartIndex) return false;
    }
    return true;
  });

  const fallbackAmounts = fallbackLines
    .flatMap(extractAmounts)
    .filter((amount) => amount > 0);

  return { totalAmount: fallbackAmounts.length > 0 ? Math.max(...fallbackAmounts) : undefined, warnings };
}

function hasItemTableHeader(line: string) {
  const normalized = normalizeForMatching(line);
  const hasNameColumn = /\b(DESKR\w*|DESCRIPTION|ITEM|PRODUK|BARANG|NAMA|MENU)\b/.test(normalized);
  const hasQuantityColumn = /\b(QTY|QTY\.|JUMLAH|JML|BANYAK|PCS)\b/.test(normalized);
  const hasPriceColumn = /\b(HARGA|PRICE|HRG|SATUAN|UNIT)\b/.test(normalized);
  const hasTotalColumn = /\b(TOTAL|JUMLAH|SUBTOTAL)\b/.test(normalized);

  return hasNameColumn && [hasQuantityColumn, hasPriceColumn, hasTotalColumn].filter(Boolean).length >= 2;
}

function isItemSectionEnd(line: string) {
  return hasAnyTerm(line, itemStopTerms);
}

function parseQuantityToken(token: string) {
  const cleaned = token.replace(/[^\d,.-]/g, "").replace(",", ".");
  const parsed = Number.parseFloat(cleaned);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function cleanItemName(name: string) {
  return name
    .replace(/^\d+(?:[.,]\d+)?\s*[xX]\s+/, "")
    .replace(/\s+[xX]\s*$/, "")
    .replace(/\s+@\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseItemLine(line: string): ParsedReceiptItem | undefined {
  if (isMetadataLine(line) || isDiscountLine(line)) {
    return undefined;
  }

  const tokens = line.split(" ");
  const numericColumns: NumericColumn[] = [];
  let nameEndIndex = tokens.length;

  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const amount = parseAmountToken(tokens[index]);

    if (typeof amount !== "number") {
      break;
    }

    numericColumns.unshift({ raw: tokens[index], amount });
    nameEndIndex = index;
  }

  if (numericColumns.length === 0) {
    return undefined;
  }

  const totalColumn = numericColumns[numericColumns.length - 1];

  if (!/[.,]/.test(totalColumn.raw) && totalColumn.amount < 100) {
    return undefined;
  }

  const name = cleanItemName(tokens.slice(0, nameEndIndex).join(" "));

  if (!/[A-Za-z]{2,}/.test(name)) {
    return undefined;
  }

  const leadingQuantity = line.match(/^(\d+(?:[.,]\d+)?)\s*[xX]\s+/);
  const totalPrice = totalColumn.amount;
  const unitPrice = numericColumns.length >= 2 ? numericColumns[numericColumns.length - 2].amount : undefined;
  const quantity =
    numericColumns.length >= 3
      ? parseQuantityToken(numericColumns[numericColumns.length - 3].raw)
      : leadingQuantity
        ? parseQuantityToken(leadingQuantity[1])
        : undefined;

  return {
    name,
    quantity,
    unitPrice,
    totalPrice
  };
}

function findItemTableStart(lines: string[]) {
  const index = lines.findIndex(hasItemTableHeader);
  return index >= 0 ? index + 1 : undefined;
}

function findFirstSummaryLine(lines: string[]) {
  const index = lines.findIndex((line) => !isDiscountLine(line) && isItemSectionEnd(line));
  return index >= 0 ? index : lines.length;
}

function extractEcommerceItems(lines: string[]) {
  const items: ParsedReceiptItem[] = [];
  const headerIndex = lines.findIndex((line) => normalizeForMatching(line).includes("NO. PRODUK VARIASI HARGA PRODUK KUANTITAS SUBTOTAL"));

  if (headerIndex < 0) {
    return items;
  }

  for (let index = headerIndex + 1; index < lines.length - 1; index += 1) {
    const currentLine = lines[index];
    const nextLine = lines[index + 1];
    const normalized = normalizeForMatching(currentLine);

    if (/^\d+$/.test(currentLine.trim())) {
      continue;
    }

    if (normalized.includes("TOTAL PEMBAYARAN") || normalized.includes("CATATAN")) {
      break;
    }

    if (!currentLine.includes("[")) {
      continue;
    }

    const amounts = extractAmountTokens(nextLine);

    if (amounts.length < 2) {
      continue;
    }

    const unitPrice = amounts[0].amount;
    const totalPrice = amounts[amounts.length - 1].amount;
    const quantityToken = amounts.length >= 3 ? amounts[amounts.length - 2].amount : totalPrice / unitPrice;
    const quantity = Number.isFinite(quantityToken) ? quantityToken : undefined;

    items.push({
      name: currentLine.trim(),
      quantity,
      unitPrice,
      totalPrice
    });
  }

  return items.slice(0, 20);
}

function extractItems(lines: string[], tableStartIndex: number | undefined, summaryStartIndex: number | undefined, isEcommerce: boolean) {
  if (isEcommerce) {
    const ecommerceItems = extractEcommerceItems(lines);

    if (ecommerceItems.length > 0) {
      return ecommerceItems;
    }
  }

  const items: ParsedReceiptItem[] = [];
  const startIndex = tableStartIndex ?? Math.min(2, lines.length);
  const endIndex = summaryStartIndex ?? lines.length;

  for (const line of lines.slice(startIndex, endIndex)) {
    if (isDiscountLine(line)) {
      continue;
    }

    if (isItemSectionEnd(line)) {
      break;
    }

    const item = parseItemLine(line);

    if (item) {
      items.push(item);
    }
  }

  return items.slice(0, 20);
}

export function parseReceiptText(rawText: string): ParsedReceipt {
  const lines = cleanLines(rawText);
  const ecommerceReceipt = isEcommerceReceipt(lines);

  const { merchant, warnings: merchantWarnings } = extractMerchant(lines);
  const { transactionDate, warnings: dateWarnings, dateDebug } = extractDate(lines);
  
  const tableStartIndex = findItemTableStart(lines);
  const summaryStartIndex = findFirstSummaryLine(lines.slice(tableStartIndex ?? 0)) + (tableStartIndex ?? 0);

  const { totalAmount, warnings: totalWarnings, totalCandidates } = extractTotal(lines, tableStartIndex, summaryStartIndex, ecommerceReceipt);
  const items = extractItems(lines, tableStartIndex, summaryStartIndex, ecommerceReceipt);

  const category = classifyReceiptCategory({ merchant, items, rawText });

  const warnings = [...merchantWarnings, ...dateWarnings, ...totalWarnings];
  const confidence = warnings.length > 0 ? "low" : "high";

  return {
    merchant,
    transactionDate,
    totalAmount,
    totalCandidates,
    items,
    category: category.name,
    categoryConfidence: category.confidence,
    categoryReason: category.reason,
    categorySource: category.source,
    dateDebug: dateDebug.length > 0 ? dateDebug : undefined,
    confidence,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}
