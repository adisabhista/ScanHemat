export type ReceiptDatePattern = "YYYY-MM-DD" | "YYYY/MM/DD" | "DD-MM-YY" | "DD/MM/YY" | "DD-MM-YYYY" | "DD/MM/YYYY" | "DD-MMM-YY" | "DD-MMM-YYYY";

export type ReceiptDateDebug = {
  rawDateText: string;
  detectedPattern?: ReceiptDatePattern;
  parsedDay?: number;
  parsedMonth?: number;
  parsedYear?: number;
  selectedIsoDate?: string;
  rejectionReason?: string;
};

export type ReceiptDateParseResult = {
  isoDate?: string;
  debug: ReceiptDateDebug;
};

const dateRejectTerms = ["TANGGAL PENGUKUHAN", "PENGUKUHAN", "NPWP", "NWP", "TAX", "PAJAK", "REGISTRATION"];

const monthMap: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MEI: 5,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AGU: 8,
  AUG: 8,
  SEP: 9,
  OKT: 10,
  OCT: 10,
  NOV: 11,
  DES: 12,
  DEC: 12
};

function normalizeForMatching(value: string) {
  return value.toUpperCase().replace(/\s+/g, " ").trim();
}

export function isNonTransactionDateLine(line: string) {
  const normalized = normalizeForMatching(line);

  return dateRejectTerms.some((term) => normalized.includes(term));
}

function toFourDigitYear(yearValue: string) {
  if (yearValue.length !== 2) {
    return Number.parseInt(yearValue, 10);
  }

  const twoDigitYear = Number.parseInt(yearValue, 10);

  return twoDigitYear <= 49 ? 2000 + twoDigitYear : 1900 + twoDigitYear;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function validateDateParts(day: number, month: number, year: number): string | undefined {
  const currentYear = new Date().getFullYear();

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return "Komponen tanggal bukan angka valid.";
  }

  if (month < 1 || month > 12) {
    return "Bulan lebih dari 12 atau kurang dari 1.";
  }

  if (day < 1 || day > 31) {
    return "Hari lebih dari 31 atau kurang dari 1.";
  }

  if (day > getDaysInMonth(year, month)) {
    return "Tanggal tidak mungkin untuk bulan tersebut.";
  }

  if (year > currentYear + 1) {
    return "Tahun transaksi terlalu jauh di masa depan.";
  }

  if (year < 1990) {
    return "Tahun transaksi terlalu lama untuk struk transaksi.";
  }

  return undefined;
}

function buildIsoDate(day: number, month: number, year: number) {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function buildResult(rawDateText: string, detectedPattern: ReceiptDatePattern, day: number, month: number, year: number): ReceiptDateParseResult {
  const rejectionReason = validateDateParts(day, month, year);
  const debug: ReceiptDateDebug = {
    rawDateText,
    detectedPattern,
    parsedDay: day,
    parsedMonth: month,
    parsedYear: year,
    rejectionReason
  };

  if (rejectionReason) {
    return { debug };
  }

  const isoDate = buildIsoDate(day, month, year);

  return {
    isoDate,
    debug: {
      ...debug,
      selectedIsoDate: isoDate
    }
  };
}

export function parseReceiptDateText(rawDateText: string): ReceiptDateParseResult {
  const trimmed = rawDateText.trim();

  if (!trimmed) {
    return {
      debug: {
        rawDateText,
        rejectionReason: "Teks tanggal kosong."
      }
    };
  }

  if (isNonTransactionDateLine(trimmed)) {
    return {
      debug: {
        rawDateText: trimmed,
        rejectionReason: "Baris berisi tanggal non-transaksi."
      }
    };
  }

  const yearMonthDay = trimmed.match(/\b(\d{4})([/-])(\d{1,2})\2(\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?\b/);
  if (yearMonthDay) {
    const year = Number.parseInt(yearMonthDay[1], 10);
    const month = Number.parseInt(yearMonthDay[3], 10);
    const day = Number.parseInt(yearMonthDay[4], 10);
    const pattern = yearMonthDay[2] === "/" ? "YYYY/MM/DD" : "YYYY-MM-DD";

    return buildResult(yearMonthDay[0], pattern, day, month, year);
  }

  const dayMonthYear = trimmed.match(/\b(\d{1,2})([/-])(\d{1,2})\2(\d{2}|\d{4})(?:\s*\(?\d{1,2}:\d{2}(?::\d{2})?\)?)?\b/);
  if (dayMonthYear) {
    const day = Number.parseInt(dayMonthYear[1], 10);
    const month = Number.parseInt(dayMonthYear[3], 10);
    const year = toFourDigitYear(dayMonthYear[4]);
    const separator = dayMonthYear[2];
    const pattern =
      separator === "/"
        ? dayMonthYear[4].length === 2
          ? "DD/MM/YY"
          : "DD/MM/YYYY"
        : dayMonthYear[4].length === 2
          ? "DD-MM-YY"
          : "DD-MM-YYYY";

    return buildResult(dayMonthYear[0], pattern, day, month, year);
  }

  const namedMonth = trimmed.match(/\b(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{2}|\d{4})\b/);
  if (namedMonth) {
    const month = monthMap[namedMonth[2].slice(0, 3).toUpperCase()];

    if (!month) {
      return {
        debug: {
          rawDateText: namedMonth[0],
          rejectionReason: "Nama bulan tidak dikenali."
        }
      };
    }

    const day = Number.parseInt(namedMonth[1], 10);
    const year = toFourDigitYear(namedMonth[3]);
    const pattern = namedMonth[3].length === 2 ? "DD-MMM-YY" : "DD-MMM-YYYY";

    return buildResult(namedMonth[0], pattern, day, month, year);
  }

  return {
    debug: {
      rawDateText: trimmed,
      rejectionReason: "Tidak ada pola tanggal transaksi yang cocok."
    }
  };
}
