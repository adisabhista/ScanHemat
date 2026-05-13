import { normalizeTransactionFilters } from "@/features/transactions/period-filter";
import { getFilterLabel } from "@/features/transactions/queries";
import type { AssistantPeriod } from "./types";

const monthNames = [
  { name: "januari", month: 1 },
  { name: "jan", month: 1 },
  { name: "februari", month: 2 },
  { name: "feb", month: 2 },
  { name: "maret", month: 3 },
  { name: "mar", month: 3 },
  { name: "april", month: 4 },
  { name: "apr", month: 4 },
  { name: "mei", month: 5 },
  { name: "juni", month: 6 },
  { name: "jun", month: 6 },
  { name: "juli", month: 7 },
  { name: "jul", month: 7 },
  { name: "agustus", month: 8 },
  { name: "agu", month: 8 },
  { name: "aug", month: 8 },
  { name: "september", month: 9 },
  { name: "sep", month: 9 },
  { name: "oktober", month: 10 },
  { name: "okt", month: 10 },
  { name: "oct", month: 10 },
  { name: "november", month: 11 },
  { name: "nov", month: 11 },
  { name: "desember", month: 12 },
  { name: "des", month: 12 },
  { name: "dec", month: 12 }
];

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

export function parseAssistantPeriod(message: string, now = new Date()): AssistantPeriod {
  const normalized = message.toLowerCase();
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();
  const isoDates = normalized.match(/\b\d{4}-\d{2}-\d{2}\b/g);

  if (isoDates && isoDates.length >= 2) {
    const filters = normalizeTransactionFilters({
      period: "custom",
      startDate: isoDates[0],
      endDate: isoDates[1]
    }, now);

    return { ...filters, periodLabel: getFilterLabel(filters, now), isExplicit: true };
  }

  if (normalized.includes("semua waktu") || normalized.includes("sepanjang waktu")) {
    const filters = normalizeTransactionFilters({ period: "all" }, now);

    return { ...filters, periodLabel: getFilterLabel(filters, now), isExplicit: true };
  }

  if (normalized.includes("tahun lalu")) {
    const filters = normalizeTransactionFilters({ period: "year", year: currentYear - 1 }, now);

    return { ...filters, periodLabel: getFilterLabel(filters, now), isExplicit: true };
  }

  if (normalized.includes("tahun ini") || normalized.includes("tahunan") || normalized.includes("keseluruhan tahun")) {
    const filters = normalizeTransactionFilters({ period: "year", year: currentYear }, now);

    return { ...filters, periodLabel: getFilterLabel(filters, now), isExplicit: true };
  }

  if (normalized.includes("bulan lalu") || normalized.includes("bulan sebelumnya")) {
    const previousMonth = addMonths(now, -1);
    const filters = normalizeTransactionFilters({
      period: "month",
      month: previousMonth.getUTCMonth() + 1,
      year: previousMonth.getUTCFullYear()
    }, now);

    return { ...filters, periodLabel: getFilterLabel(filters, now), isExplicit: true };
  }

  const explicitMonth = monthNames.find((month) => new RegExp(`\\b${month.name}\\b`).test(normalized));
  if (explicitMonth) {
    const yearMatch = normalized.match(/\b(20\d{2}|19\d{2})\b/);
    const filters = normalizeTransactionFilters({
      period: "month",
      month: explicitMonth.month,
      year: yearMatch ? Number(yearMatch[1]) : currentYear
    }, now);

    return { ...filters, periodLabel: getFilterLabel(filters, now), isExplicit: true };
  }

  const filters = normalizeTransactionFilters({ period: "month", month: currentMonth, year: currentYear }, now);

  if (normalized.includes("minggu ini")) {
    const day = now.getUTCDay() || 7;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const weekFilters = normalizeTransactionFilters({
      period: "custom",
      startDate: toInputDate(start),
      endDate: toInputDate(end)
    }, now);

    return { ...weekFilters, periodLabel: "Minggu Ini", isExplicit: true };
  }

  if (normalized.includes("bulan ini")) {
    return { ...filters, periodLabel: getFilterLabel(filters, now), isExplicit: true };
  }

  return { ...filters, periodLabel: getFilterLabel(filters, now), isExplicit: false };
}
