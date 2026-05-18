import { Prisma } from "@prisma/client";

import { normalizeTransactionFilters, type TransactionFilters } from "@/features/transactions/period-filter";
import { getFilterLabel, getTransactionDateRange } from "@/features/transactions/queries";
import {
  getUpcomingExpenseSummary as getReminderUpcomingExpenseSummary,
  getUpcomingRemindersForAssistant
} from "@/features/reminders/queries";
import { prisma } from "@/lib/prisma";
import { formatAssistantCurrency, formatAssistantDate } from "./format";
import {
  assistantToolNames,
  budgetStatusArgsSchema,
  categoryBreakdownArgsSchema,
  itemPriceHistoryArgsSchema,
  largestTransactionsArgsSchema,
  merchantBreakdownArgsSchema,
  monthlyBreakdownArgsSchema,
  recentTransactionsArgsSchema,
  smallFrequentTransactionsArgsSchema,
  spendingSummaryArgsSchema,
  upcomingRemindersArgsSchema,
  type AssistantFunctionToolName
} from "./tool-schemas";

type MoneyLike = number | string | Prisma.Decimal | null | undefined;

export type AssistantTransactionRecord = {
  transactionDate: Date;
  merchant: string | null;
  totalAmount: MoneyLike;
  notes?: string | null;
  category: { name: string };
  items: {
    name: string;
    quantity?: MoneyLike;
    unitPrice?: MoneyLike;
    totalPrice?: MoneyLike;
  }[];
};

export type AssistantBudgetRecord = {
  amount: MoneyLike;
  categoryId: string;
  category: { name: string };
};

export type AssistantToolCallDebug = {
  name: string;
  args: Record<string, unknown>;
  resultCount: number;
};

export function toNumber(value: MoneyLike) {
  if (!value) {
    return 0;
  }

  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }

  return Number(value) || 0;
}

export function buildAssistantTransactionWhere(userId: string, filters: TransactionFilters = {}) {
  const where: Prisma.TransactionWhereInput = { userId };
  const { start, end } = getTransactionDateRange(filters);

  if (start || end) {
    where.transactionDate = {
      ...(start ? { gte: start } : {}),
      ...(end ? { lt: end } : {})
    };
  }

  return where;
}

async function fetchAssistantTransactions(userId: string, filters: TransactionFilters = {}) {
  return prisma.transaction.findMany({
    where: buildAssistantTransactionWhere(userId, filters),
    include: {
      category: true,
      items: true
    },
    orderBy: {
      transactionDate: "desc"
    }
  });
}

export function buildSpendingSummary(transactions: AssistantTransactionRecord[], periodLabel: string) {
  const totalExpense = transactions.reduce((sum, transaction) => sum + toNumber(transaction.totalAmount), 0);

  return {
    totalExpense,
    totalExpenseLabel: formatAssistantCurrency(totalExpense),
    transactionCount: transactions.length,
    periodLabel
  };
}

export function buildCategoryBreakdown(transactions: AssistantTransactionRecord[]) {
  const total = transactions.reduce((sum, transaction) => sum + toNumber(transaction.totalAmount), 0);
  const totals = transactions.reduce<Record<string, { amount: number; transactionCount: number }>>((items, transaction) => {
    const existing = items[transaction.category.name] ?? { amount: 0, transactionCount: 0 };
    items[transaction.category.name] = {
      amount: existing.amount + toNumber(transaction.totalAmount),
      transactionCount: existing.transactionCount + 1
    };
    return items;
  }, {});

  return Object.entries(totals)
    .map(([categoryName, item]) => ({
      categoryName,
      amount: item.amount,
      amountLabel: formatAssistantCurrency(item.amount),
      percentage: total > 0 ? Math.round((item.amount / total) * 1000) / 10 : 0,
      transactionCount: item.transactionCount
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function buildMerchantBreakdown(transactions: AssistantTransactionRecord[]) {
  const totals = transactions.reduce<Record<string, { amount: number; transactionCount: number }>>((items, transaction) => {
    const merchantName = transaction.merchant?.trim() || "Tanpa merchant";
    const existing = items[merchantName] ?? { amount: 0, transactionCount: 0 };

    items[merchantName] = {
      amount: existing.amount + toNumber(transaction.totalAmount),
      transactionCount: existing.transactionCount + 1
    };

    return items;
  }, {});

  return Object.entries(totals)
    .map(([merchantName, item]) => ({
      merchantName,
      amount: item.amount,
      amountLabel: formatAssistantCurrency(item.amount),
      transactionCount: item.transactionCount
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function buildRecentTransactions(transactions: AssistantTransactionRecord[], take = 5) {
  return transactions.slice(0, take).map((transaction) => ({
    date: transaction.transactionDate.toISOString().slice(0, 10),
    dateLabel: formatAssistantDate(transaction.transactionDate),
    merchant: transaction.merchant ?? "Tanpa merchant",
    category: transaction.category.name,
    totalAmount: toNumber(transaction.totalAmount),
    totalAmountLabel: formatAssistantCurrency(toNumber(transaction.totalAmount))
  }));
}

export function buildLargestTransactions(transactions: AssistantTransactionRecord[], limit = 3) {
  return [...transactions]
    .sort((a, b) => toNumber(b.totalAmount) - toNumber(a.totalAmount))
    .slice(0, limit)
    .map((transaction) => ({
      date: transaction.transactionDate.toISOString().slice(0, 10),
      dateLabel: formatAssistantDate(transaction.transactionDate),
      merchant: transaction.merchant ?? "Tanpa merchant",
      category: transaction.category.name,
      totalAmount: toNumber(transaction.totalAmount),
      totalAmountLabel: formatAssistantCurrency(toNumber(transaction.totalAmount)),
      note: transaction.notes ?? null,
      items: transaction.items.map((item) => item.name).slice(0, 5)
    }));
}

export function buildMonthlyBreakdown(transactions: AssistantTransactionRecord[], year: number) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const monthTransactions = transactions.filter(
      (transaction) => transaction.transactionDate.getUTCFullYear() === year && transaction.transactionDate.getUTCMonth() + 1 === month
    );
    const categoryTotals = buildCategoryBreakdown(monthTransactions);
    const totalExpense = monthTransactions.reduce((sum, transaction) => sum + toNumber(transaction.totalAmount), 0);
    const date = new Date(Date.UTC(year, index, 1));

    return {
      month,
      year,
      monthLabel: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(date),
      totalExpense,
      totalExpenseLabel: formatAssistantCurrency(totalExpense),
      transactionCount: monthTransactions.length,
      topCategory: categoryTotals[0]?.categoryName ?? null
    };
  }).filter((item) => item.transactionCount > 0);
}

export function buildItemPriceHistory(transactions: AssistantTransactionRecord[], itemKeyword?: string) {
  const keyword = itemKeyword?.trim().toLowerCase();

  if (!keyword) {
    return [];
  }

  return transactions
    .flatMap((transaction) =>
      transaction.items
        .filter((item) => item.name.toLowerCase().includes(keyword))
        .map((item) => ({
          itemName: item.name,
          merchant: transaction.merchant ?? "Tanpa merchant",
      date: transaction.transactionDate.toISOString().slice(0, 10),
      dateLabel: formatAssistantDate(transaction.transactionDate),
      unitPrice: toNumber(item.unitPrice),
      unitPriceLabel: item.unitPrice ? formatAssistantCurrency(toNumber(item.unitPrice)) : null,
      quantity: item.quantity ? toNumber(item.quantity) : null,
      totalPrice: toNumber(item.totalPrice),
      totalPriceLabel: item.totalPrice ? formatAssistantCurrency(toNumber(item.totalPrice)) : null
    }))
    )
    .slice(0, 20);
}

export function buildSmallFrequentTransactions(transactions: AssistantTransactionRecord[], thresholdAmount = 30000) {
  const smallTransactions = transactions.filter((transaction) => toNumber(transaction.totalAmount) <= thresholdAmount);
  const totalAmount = smallTransactions.reduce((sum, transaction) => sum + toNumber(transaction.totalAmount), 0);
  const commonMerchants = buildMerchantBreakdown(smallTransactions).slice(0, 5);

  return {
    thresholdAmount,
    thresholdLabel: formatAssistantCurrency(thresholdAmount),
    count: smallTransactions.length,
    totalAmount,
    totalAmountLabel: formatAssistantCurrency(totalAmount),
    commonMerchants
  };
}

export function buildUnusualTransactions(
  allTransactions: AssistantTransactionRecord[],
  currentTransactions: AssistantTransactionRecord[]
) {
  if (allTransactions.length < 3) {
    return [];
  }

  const historicalAverage =
    allTransactions.reduce((sum, transaction) => sum + toNumber(transaction.totalAmount), 0) / allTransactions.length;
  const threshold = Math.max(historicalAverage * 1.8, historicalAverage + 50000);

  return currentTransactions
    .filter((transaction) => toNumber(transaction.totalAmount) >= threshold)
    .map((transaction) => ({
      date: transaction.transactionDate.toISOString().slice(0, 10),
      dateLabel: formatAssistantDate(transaction.transactionDate),
      merchant: transaction.merchant ?? "Tanpa merchant",
      category: transaction.category.name,
      totalAmount: toNumber(transaction.totalAmount),
      totalAmountLabel: formatAssistantCurrency(toNumber(transaction.totalAmount)),
      historicalAverage,
      historicalAverageLabel: formatAssistantCurrency(historicalAverage)
    }))
    .slice(0, 10);
}

export function buildBudgetStatus(budgets: AssistantBudgetRecord[], monthTransactions: AssistantTransactionRecord[]) {
  return budgets
    .map((budget) => {
      const spentAmount = monthTransactions
        .filter((transaction) => transaction.category.name === budget.category.name)
        .reduce((sum, transaction) => sum + toNumber(transaction.totalAmount), 0);
      const budgetAmount = toNumber(budget.amount);
      const remainingAmount = budgetAmount - spentAmount;

      return {
        category: budget.category.name,
        budgetAmount,
        budgetAmountLabel: formatAssistantCurrency(budgetAmount),
        spentAmount,
        spentAmountLabel: formatAssistantCurrency(spentAmount),
        remainingAmount,
        remainingAmountLabel: formatAssistantCurrency(remainingAmount),
        status: remainingAmount < 0 ? "exceeded" : remainingAmount <= budgetAmount * 0.2 ? "warning" : "safe"
      };
    })
    .sort((a, b) => a.remainingAmount - b.remainingAmount);
}

function resolvePeriodFilters(args: {
  period?: "month" | "year" | "all" | "custom";
  month?: number;
  year?: number;
  startDate?: string;
  endDate?: string;
}, now: Date) {
  const normalized = normalizeTransactionFilters(args, now);

  return {
    filters: normalized,
    periodLabel: getFilterLabel(normalized, now)
  };
}

function limitItems<T>(items: T[], limit?: number) {
  return typeof limit === "number" ? items.slice(0, limit) : items;
}

function publicCategoryBreakdown(items: ReturnType<typeof buildCategoryBreakdown>, limit?: number) {
  return limitItems(items, limit).map(({ categoryName, amount, percentage, transactionCount }) => ({
    categoryName,
    amount,
    percentage,
    transactionCount
  }));
}

function publicMerchantBreakdown(items: ReturnType<typeof buildMerchantBreakdown>, limit?: number) {
  return limitItems(items, limit).map(({ merchantName, amount, transactionCount }) => ({
    merchantName,
    amount,
    transactionCount
  }));
}

function publicLargestTransactions(items: ReturnType<typeof buildLargestTransactions>) {
  return items.map(({ date, merchant, category, totalAmount, note }) => ({
    date,
    merchant,
    category,
    totalAmount,
    ...(note ? { note } : {})
  }));
}

function publicMonthlyBreakdown(items: ReturnType<typeof buildMonthlyBreakdown>) {
  return items.map(({ month, monthLabel, totalExpense, transactionCount, topCategory }) => ({
    month,
    monthLabel,
    totalExpense,
    transactionCount,
    ...(topCategory ? { topCategory } : {})
  }));
}

function publicRecentTransactions(items: ReturnType<typeof buildRecentTransactions>) {
  return items.map(({ date, merchant, category, totalAmount }) => ({
    date,
    merchant,
    category,
    totalAmount
  }));
}

function publicSmallFrequentTransactions(item: ReturnType<typeof buildSmallFrequentTransactions>) {
  return {
    thresholdAmount: item.thresholdAmount,
    count: item.count,
    totalAmount: item.totalAmount,
    commonMerchants: publicMerchantBreakdown(item.commonMerchants)
  };
}

function publicItemPriceHistory(items: ReturnType<typeof buildItemPriceHistory>, limit?: number) {
  return limitItems(items, limit).map(({ date, merchant, itemName, quantity, unitPrice, totalPrice }) => ({
    date,
    merchant,
    itemName,
    ...(quantity ? { quantity } : {}),
    ...(unitPrice ? { unitPrice } : {}),
    ...(totalPrice ? { totalPrice } : {})
  }));
}

export async function getSpendingSummary(userId: string, filters: TransactionFilters, periodLabel: string) {
  const transactions = await fetchAssistantTransactions(userId, filters);

  return buildSpendingSummary(transactions, periodLabel);
}

export async function getCategoryBreakdown(userId: string, filters: TransactionFilters) {
  const transactions = await fetchAssistantTransactions(userId, filters);

  return buildCategoryBreakdown(transactions);
}

export async function getMerchantBreakdown(userId: string, filters: TransactionFilters) {
  const transactions = await fetchAssistantTransactions(userId, filters);

  return buildMerchantBreakdown(transactions);
}

export async function getRecentTransactions(userId: string, filters: TransactionFilters, limit = 5) {
  const transactions = await fetchAssistantTransactions(userId, filters);

  return buildRecentTransactions(transactions, limit);
}

export async function getLargestTransactions(userId: string, filters: TransactionFilters, limit = 3) {
  const transactions = await fetchAssistantTransactions(userId, filters);

  return buildLargestTransactions(transactions, limit);
}

export async function getMonthlyBreakdown(userId: string, year: number) {
  const transactions = await fetchAssistantTransactions(userId, { period: "year", year });

  return buildMonthlyBreakdown(transactions, year);
}

export async function getTransactionsByMerchant(
  userId: string,
  filters: TransactionFilters,
  merchantName: string,
  periodLabel: string
) {
  const transactions = await fetchAssistantTransactions(userId, filters);
  const normalizedMerchant = merchantName.toLowerCase();
  const matchingTransactions = transactions.filter((transaction) =>
    transaction.merchant?.toLowerCase().includes(normalizedMerchant)
  );

  return {
    merchantName,
    summary: buildSpendingSummary(matchingTransactions, periodLabel),
    transactions: buildRecentTransactions(matchingTransactions, 10)
  };
}

export async function getItemPriceHistory(userId: string, filters: TransactionFilters, itemKeyword?: string) {
  const transactions = await fetchAssistantTransactions(userId, filters);

  return buildItemPriceHistory(transactions, itemKeyword);
}

export async function getBudgetStatus(userId: string, year: number, month: number) {
  const [budgets, transactions] = await Promise.all([
    prisma.budget.findMany({
      where: { userId, year, month },
      include: { category: true }
    }),
    fetchAssistantTransactions(userId, { period: "month", year, month })
  ]);

  return buildBudgetStatus(budgets, transactions);
}

export async function getBudgetStatusForYear(userId: string, year: number) {
  const [budgets, transactions] = await Promise.all([
    prisma.budget.findMany({
      where: { userId, year },
      include: { category: true }
    }),
    fetchAssistantTransactions(userId, { period: "year", year })
  ]);
  const budgetTotals = budgets.reduce<Record<string, AssistantBudgetRecord>>((items, budget) => {
    const existing = items[budget.categoryId];
    items[budget.categoryId] = {
      categoryId: budget.categoryId,
      category: { name: budget.category.name },
      amount: (existing ? toNumber(existing.amount) : 0) + toNumber(budget.amount)
    };
    return items;
  }, {});

  return buildBudgetStatus(Object.values(budgetTotals), transactions);
}

export async function getSmallFrequentTransactions(
  userId: string,
  filters: TransactionFilters,
  thresholdAmount = 30000
) {
  const transactions = await fetchAssistantTransactions(userId, filters);

  return buildSmallFrequentTransactions(transactions, thresholdAmount);
}

export async function getUnusualTransactions(userId: string, filters: TransactionFilters) {
  const [allTransactions, currentTransactions] = await Promise.all([
    fetchAssistantTransactions(userId, { period: "all" }),
    fetchAssistantTransactions(userId, filters)
  ]);

  return buildUnusualTransactions(allTransactions, currentTransactions);
}

export async function getUpcomingReminders(
  userId: string,
  args: { period: "week" | "month" | "next30days" | "all"; type?: Parameters<typeof getUpcomingRemindersForAssistant>[1]["type"] },
  now = new Date()
) {
  return getUpcomingRemindersForAssistant(userId, args, now);
}

export async function getUpcomingExpenseSummary(userId: string, now = new Date()) {
  return getReminderUpcomingExpenseSummary(userId, now);
}

export function isAssistantFunctionToolName(name: string): name is AssistantFunctionToolName {
  return assistantToolNames.includes(name as AssistantFunctionToolName);
}

export function getToolResultCount(result: unknown): number {
  if (Array.isArray(result)) {
    return result.length;
  }

  if (result && typeof result === "object") {
    if ("transactionCount" in result && typeof result.transactionCount === "number") {
      return result.transactionCount;
    }

    if ("count" in result && typeof result.count === "number") {
      return result.count;
    }
  }

  return result ? 1 : 0;
}

export async function executeAssistantTool(userId: string, name: string, args: unknown, now = new Date()) {
  if (!isAssistantFunctionToolName(name)) {
    throw new Error(`Unknown assistant tool: ${name}`);
  }

  if (name === "getSpendingSummary") {
    const parsed = spendingSummaryArgsSchema.parse(args);
    const { filters, periodLabel } = resolvePeriodFilters(parsed, now);
    const result = await getSpendingSummary(userId, filters, periodLabel);
    return {
      periodLabel: result.periodLabel,
      totalExpense: result.totalExpense,
      transactionCount: result.transactionCount
    };
  }

  if (name === "getCategoryBreakdown") {
    const parsed = categoryBreakdownArgsSchema.parse(args);
    const { filters } = resolvePeriodFilters(parsed, now);
    return publicCategoryBreakdown(await getCategoryBreakdown(userId, filters), parsed.limit);
  }

  if (name === "getMerchantBreakdown") {
    const parsed = merchantBreakdownArgsSchema.parse(args);
    const { filters } = resolvePeriodFilters(parsed, now);
    return publicMerchantBreakdown(await getMerchantBreakdown(userId, filters), parsed.limit);
  }

  if (name === "getLargestTransactions") {
    const parsed = largestTransactionsArgsSchema.parse(args);
    const { filters } = resolvePeriodFilters(parsed, now);
    return publicLargestTransactions(await getLargestTransactions(userId, filters, parsed.limit ?? 3));
  }

  if (name === "getMonthlyBreakdown") {
    const parsed = monthlyBreakdownArgsSchema.parse(args);
    return publicMonthlyBreakdown(await getMonthlyBreakdown(userId, parsed.year));
  }

  if (name === "getRecentTransactions") {
    const parsed = recentTransactionsArgsSchema.parse(args);
    return publicRecentTransactions(await getRecentTransactions(userId, { period: "all" }, parsed.limit ?? 5));
  }

  if (name === "getSmallFrequentTransactions") {
    const parsed = smallFrequentTransactionsArgsSchema.parse(args);
    const { filters } = resolvePeriodFilters(parsed, now);
    return publicSmallFrequentTransactions(await getSmallFrequentTransactions(userId, filters, parsed.thresholdAmount ?? 30000));
  }

  if (name === "getBudgetStatus") {
    const parsed = budgetStatusArgsSchema.parse(args);
    const year = parsed.year ?? now.getUTCFullYear();
    const result =
      parsed.period === "year"
        ? await getBudgetStatusForYear(userId, year)
        : await getBudgetStatus(userId, year, parsed.month ?? now.getUTCMonth() + 1);

    return result.map(({ category, budgetAmount, spentAmount, remainingAmount, status }) => ({
      categoryName: category,
      budgetAmount,
      spentAmount,
      remainingAmount,
      status
    }));
  }

  if (name === "getUpcomingReminders") {
    const parsed = upcomingRemindersArgsSchema.parse(args);
    return getUpcomingReminders(userId, parsed, now);
  }

  if (name === "getUpcomingExpenseSummary") {
    return getUpcomingExpenseSummary(userId, now);
  }

  const parsed = itemPriceHistoryArgsSchema.parse(args);
  return publicItemPriceHistory(await getItemPriceHistory(userId, { period: "all" }, parsed.keyword), parsed.limit);
}
