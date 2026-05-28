export const transactionPeriods = ["month", "year", "all", "custom"] as const;

export type TransactionPeriod = (typeof transactionPeriods)[number];

export type TransactionFilters = {
  period?: TransactionPeriod;
  month?: number;
  year?: number;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  search?: string;
  needsReview?: boolean;
};

export type VisiblePeriodControls = {
  showMonth: boolean;
  showYear: boolean;
  showCustomRange: boolean;
};

export function normalizeTransactionPeriod(value: string | undefined): TransactionPeriod {
  return transactionPeriods.includes(value as TransactionPeriod) ? (value as TransactionPeriod) : "month";
}

export function getVisiblePeriodControls(period: TransactionPeriod): VisiblePeriodControls {
  return {
    showMonth: period === "month",
    showYear: period === "month" || period === "year",
    showCustomRange: period === "custom"
  };
}

export function normalizeTransactionFilters(filters: TransactionFilters = {}, now = new Date()): Required<Pick<TransactionFilters, "period">> & TransactionFilters {
  const period = filters.period ?? "month";
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();
  const categoryId = filters.categoryId || undefined;
  const search = filters.search?.trim() || undefined;
  const needsReview = filters.needsReview || undefined;

  if (period === "all") {
    return {
      period,
      categoryId,
      search,
      ...(needsReview ? { needsReview } : {})
    };
  }

  if (period === "year") {
    return {
      period,
      year: filters.year ?? currentYear,
      categoryId,
      search,
      ...(needsReview ? { needsReview } : {})
    };
  }

  if (period === "custom") {
    return {
      period,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      categoryId,
      search,
      ...(needsReview ? { needsReview } : {})
    };
  }

  return {
    period,
    month: filters.month ?? currentMonth,
    year: filters.year ?? currentYear,
    categoryId,
    search,
    ...(needsReview ? { needsReview } : {})
  };
}

export function buildTransactionFilterSearchParams(filters: TransactionFilters = {}, now = new Date()) {
  const normalized = normalizeTransactionFilters(filters, now);
  const params = new URLSearchParams({
    period: normalized.period
  });

  if (normalized.period === "month") {
    params.set("month", String(normalized.month));
    params.set("year", String(normalized.year));
  }

  if (normalized.period === "year") {
    params.set("year", String(normalized.year));
  }

  if (normalized.period === "custom") {
    if (normalized.startDate) {
      params.set("startDate", normalized.startDate);
    }

    if (normalized.endDate) {
      params.set("endDate", normalized.endDate);
    }
  }

  if (normalized.categoryId) {
    params.set("categoryId", normalized.categoryId);
  }

  if (normalized.search) {
    params.set("search", normalized.search);
  }

  if (normalized.needsReview) {
    params.set("needsReview", "1");
  }

  return params;
}
