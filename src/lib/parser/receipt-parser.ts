export type ParsedReceiptItem = {
  name: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
};

export type ParsedReceipt = {
  merchant?: string;
  transactionDate?: string;
  totalAmount?: number;
  items: ParsedReceiptItem[];
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
  "HTTP"
];

const dateRejectTerms = ["TANGGAL PENGUKUHAN", "PENGUKUHAN", "NPWP", "NWP"];

const totalKeywords = [
  "GRAND TOTAL",
  "TOTAL BELANJA",
  "TOTAL HARGA",
  "JUMLAH BAYAR",
  "SUB TOTAL",
  "SUBTOTAL",
  "PEMBAYARAN",
  "TOTAL",
  "JUMLAH",
  "BAYAR"
];

const totalRejectTerms = [
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
  "PROMO"
];

const itemStopTerms = [
  "SUBTOTAL",
  "SUB TOTAL",
  "GRAND TOTAL",
  "TOTAL BELANJA",
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

const monthMap: Record<string, string> = {
  JAN: "01",
  FEB: "02",
  MAR: "03",
  APR: "04",
  MEI: "05",
  MAY: "05",
  JUN: "06",
  JUL: "07",
  AGU: "08",
  AUG: "08",
  SEP: "09",
  OKT: "10",
  OCT: "10",
  NOV: "11",
  DES: "12",
  DEC: "12"
};

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
  const withoutCurrency = token.trim().replace(/^rp\s*/i, "");

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
  const matches = line.match(/(?:Rp\s*)?-?\d{1,3}(?:[.,]\d{3})+(?:,\d{2})?|(?:Rp\s*)?-?\d+/gi) ?? [];

  return matches
    .map((match) => ({ raw: match, amount: parseAmountToken(match) }))
    .filter((match): match is AmountToken => typeof match.amount === "number");
}

function extractAmounts(line: string) {
  return extractAmountTokens(line).map((token) => token.amount);
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

function extractMerchant(lines: string[]) {
  return lines.slice(0, 8).find(isLikelyMerchantLine) ?? lines.find(isLikelyMerchantLine);
}

function buildDate(yearValue: string, monthValue: string, dayValue: string) {
  const day = dayValue.padStart(2, "0");
  const month = monthValue.padStart(2, "0");
  const year = yearValue.length === 2 ? `20${yearValue}` : yearValue;

  return `${year}-${month}-${day}`;
}

function extractDateFromLine(line: string) {
  if (hasAnyTerm(line, dateRejectTerms)) {
    return undefined;
  }

  const iso = line.match(/\b(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?\b/);

  if (iso) {
    return buildDate(iso[1], iso[2], iso[3]);
  }

  const numeric = line.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:\s*\(?\d{1,2}:\d{2}(?::\d{2})?\)?)?\b/);

  if (numeric) {
    return buildDate(numeric[3], numeric[2], numeric[1]);
  }

  const named = line.match(/\b(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{2,4})\b/);

  if (named) {
    const month = monthMap[named[2].slice(0, 3).toUpperCase()];

    if (month) {
      return buildDate(named[3], month, named[1]);
    }
  }

  return undefined;
}

function extractDate(lines: string[]) {
  for (const line of lines) {
    const date = extractDateFromLine(line);

    if (date) {
      return date;
    }
  }

  return undefined;
}

function isTotalCandidateLine(line: string) {
  const normalized = normalizeForMatching(line);

  return totalKeywords.some((keyword) => normalized.includes(keyword)) && !totalRejectTerms.some((keyword) => normalized.includes(keyword));
}

function getTotalKeywordRank(line: string) {
  const normalized = normalizeForMatching(line);
  const index = totalKeywords.findIndex((keyword) => normalized.includes(keyword));

  return index >= 0 ? index : Number.POSITIVE_INFINITY;
}

function extractTotal(lines: string[]) {
  const candidates: { amount: number; rank: number; index: number }[] = [];

  for (const [index, line] of lines.entries()) {
    if (isTotalCandidateLine(line)) {
      const amounts = extractAmounts(line).filter((amount) => amount > 0);

      if (amounts.length > 0) {
        candidates.push({
          amount: amounts[amounts.length - 1],
          rank: getTotalKeywordRank(line),
          index
        });
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((first, second) => first.rank - second.rank || second.index - first.index);
    return candidates[0].amount;
  }

  const fallbackAmounts = lines
    .filter((line) => !isMetadataLine(line) && !isDiscountLine(line))
    .flatMap(extractAmounts)
    .filter((amount) => amount > 0);

  return fallbackAmounts.length > 0 ? Math.max(...fallbackAmounts) : undefined;
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

function extractItems(lines: string[]) {
  const items: ParsedReceiptItem[] = [];
  const tableStart = findItemTableStart(lines);
  const startIndex = tableStart ?? Math.min(2, lines.length);
  const endIndex = findFirstSummaryLine(lines.slice(startIndex)) + startIndex;

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

  return {
    merchant: extractMerchant(lines),
    transactionDate: extractDate(lines),
    totalAmount: extractTotal(lines),
    items: extractItems(lines)
  };
}
