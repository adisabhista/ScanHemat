import type { TransactionFilters } from "@/features/transactions/period-filter";
import { resolveAssistantIntent } from "./intent";
import { parseAssistantPeriod } from "./period";
import {
  getBudgetStatus,
  getCategoryBreakdown,
  getItemPriceHistory,
  getLargestTransactions,
  getMerchantBreakdown,
  getMonthlyBreakdown,
  getRecentTransactions,
  getUpcomingExpenseSummary,
  getUpcomingReminders,
  getSmallFrequentTransactions,
  getSpendingSummary,
  getTransactionsByMerchant,
  getUnusualTransactions
} from "./tools";
import type { AssistantContext, AssistantMessage, AssistantToolName } from "./types";
import { formatAssistantCurrency, formatAssistantDate } from "./format";

function hasData(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (!value || typeof value !== "object") {
    return Boolean(value);
  }

  if ("transactionCount" in value && typeof value.transactionCount === "number") {
    return value.transactionCount > 0;
  }

  if ("count" in value && typeof value.count === "number") {
    return value.count > 0;
  }

  if ("summary" in value && value.summary && typeof value.summary === "object") {
    return hasData(value.summary);
  }

  return Object.keys(value).length > 0;
}

function getBudgetMonth(filters: TransactionFilters, now: Date) {
  if (filters.period === "month" && filters.month && filters.year) {
    return { month: filters.month, year: filters.year };
  }

  return {
    month: now.getUTCMonth() + 1,
    year: now.getUTCFullYear()
  };
}

function countToolResults(data: Record<string, unknown>): number {
  return Object.values(data).reduce<number>((count, value) => {
    if (Array.isArray(value)) {
      return count + value.length;
    }

    if (value && typeof value === "object" && "transactions" in value && Array.isArray(value.transactions)) {
      return count + value.transactions.length;
    }

    if (value && typeof value === "object" && "transactionCount" in value && typeof value.transactionCount === "number") {
      return count + value.transactionCount;
    }

    if (value && typeof value === "object" && "count" in value && typeof value.count === "number") {
      return count + value.count;
    }

    return count;
  }, 0);
}

export async function buildAssistantContext(userId: string, messages: AssistantMessage[], now = new Date()): Promise<AssistantContext> {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const latestMessage = latestUserMessage?.content ?? "";
  const intentResult = resolveAssistantIntent(messages);
  const period = parseAssistantPeriod(latestMessage, now);
  const filters: TransactionFilters = period;
  const tools: AssistantToolName[] = [];
  const data: Record<string, unknown> = {};

  if (intentResult.needsClarification) {
    return {
      intent: intentResult.intent,
      previousIntent: intentResult.previousIntent,
      tools,
      period,
      data,
      hasEnoughData: false,
      needsClarification: true,
      clarifyingQuestion: intentResult.clarifyingQuestion,
      resultCount: 0
    };
  }

  if (intentResult.intent === "spending_summary") {
    tools.push("getSpendingSummary");
    data.summary = await getSpendingSummary(userId, filters, period.periodLabel);
  }

  if (intentResult.intent === "category_breakdown") {
    tools.push("getSpendingSummary", "getCategoryBreakdown");
    data.summary = await getSpendingSummary(userId, filters, period.periodLabel);
    data.categories = await getCategoryBreakdown(userId, filters);
  }

  if (intentResult.intent === "merchant_breakdown") {
    if (intentResult.merchantName) {
      tools.push("getTransactionsByMerchant");
      data.merchant = await getTransactionsByMerchant(userId, filters, intentResult.merchantName, period.periodLabel);
    } else {
      tools.push("getMerchantBreakdown");
      data.merchants = await getMerchantBreakdown(userId, filters);
    }
  }

  if (intentResult.intent === "largest_transactions") {
    tools.push("getLargestTransactions");
    data.largestTransactions = await getLargestTransactions(userId, filters, 3);
  }

  if (intentResult.intent === "monthly_breakdown") {
    const year = period.period === "year" && period.year ? period.year : now.getUTCFullYear();
    tools.push("getMonthlyBreakdown");
    data.monthlyBreakdown = await getMonthlyBreakdown(userId, year);
  }

  if (intentResult.intent === "recent_transactions") {
    tools.push("getRecentTransactions");
    data.recentTransactions = await getRecentTransactions(userId, filters);
  }

  if (intentResult.intent === "item_price_history") {
    tools.push("getItemPriceHistory");
    data.itemKeyword = intentResult.itemKeyword;
    data.itemPriceHistory = await getItemPriceHistory(userId, filters, intentResult.itemKeyword);
  }

  if (intentResult.intent === "budget_status") {
    const budgetMonth = getBudgetMonth(filters, now);
    tools.push("getBudgetStatus");
    data.budgetMonth = budgetMonth;
    data.budgets = await getBudgetStatus(userId, budgetMonth.year, budgetMonth.month);
  }

  if (intentResult.intent === "small_frequent_transactions") {
    tools.push("getSmallFrequentTransactions");
    data.smallTransactions = await getSmallFrequentTransactions(userId, filters, intentResult.thresholdAmount ?? 30000);
  }

  if (intentResult.intent === "unusual_transactions") {
    tools.push("getUnusualTransactions");
    data.unusualTransactions = await getUnusualTransactions(userId, filters);
  }

  if (intentResult.intent === "upcoming_reminders") {
    tools.push("getUpcomingExpenseSummary", "getUpcomingReminders");
    data.reminderSummary = await getUpcomingExpenseSummary(userId, now);
    data.reminders = await getUpcomingReminders(
      userId,
      {
        period: intentResult.reminderPeriod ?? "next30days",
        type: intentResult.reminderType
      },
      now
    );
  }

  if (intentResult.intent === "upcoming_expense_summary") {
    tools.push("getUpcomingExpenseSummary");
    data.reminderSummary = await getUpcomingExpenseSummary(userId, now);
  }

  if (intentResult.intent === "savings_advice") {
    const budgetMonth = getBudgetMonth(filters, now);
    tools.push(
      "getSpendingSummary",
      "getCategoryBreakdown",
      "getMerchantBreakdown",
      "getSmallFrequentTransactions",
      "getBudgetStatus"
    );
    data.summary = await getSpendingSummary(userId, filters, period.periodLabel);
    data.categories = await getCategoryBreakdown(userId, filters);
    data.merchants = await getMerchantBreakdown(userId, filters);
    data.smallTransactions = await getSmallFrequentTransactions(userId, filters, 30000);
    data.budgets = await getBudgetStatus(userId, budgetMonth.year, budgetMonth.month);
  }

  return {
    intent: intentResult.intent,
    previousIntent: intentResult.previousIntent,
    tools,
    period,
    data,
    hasEnoughData: Object.values(data).some(hasData),
    resultCount: countToolResults(data)
  };
}

export function buildDeterministicAssistantAnswer(context: AssistantContext) {
  if (context.needsClarification) {
    return context.clarifyingQuestion ?? "Maksud Anda ingin melihat bulan sebelumnya, semua bulan, atau bulan tertentu?";
  }

  if (!context.hasEnoughData) {
    if (context.intent === "unusual_transactions") {
      return "Data transaksi belum cukup untuk membuat analisis yang akurat.";
    }

    return "Saya tidak menemukan data pada periode tersebut.";
  }

  if (context.intent === "spending_summary" && context.data.summary && typeof context.data.summary === "object") {
    const summary = context.data.summary as { totalExpenseLabel?: string; transactionCount?: number; periodLabel?: string };

    return `Total pengeluaran ${summary.periodLabel ?? context.period.periodLabel}: ${summary.totalExpenseLabel ?? "Rp0"} dari ${summary.transactionCount ?? 0} transaksi.`;
  }

  if (context.intent === "small_frequent_transactions" && context.data.smallTransactions && typeof context.data.smallTransactions === "object") {
    const small = context.data.smallTransactions as { count?: number; totalAmountLabel?: string; thresholdLabel?: string };

    return `Ada ${small.count ?? 0} transaksi kecil di bawah ${small.thresholdLabel ?? "Rp30.000"} dengan total ${small.totalAmountLabel ?? "Rp0"}.`;
  }

  if (context.intent === "category_breakdown" && Array.isArray(context.data.categories)) {
    const categories = context.data.categories as { categoryName: string; amountLabel: string; percentage: number }[];
    const topCategories = categories.slice(0, 3).map((category) => `- ${category.categoryName}: ${category.amountLabel} (${category.percentage}%)`);

    return `Kategori terbesar pada ${context.period.periodLabel}:\n${topCategories.join("\n")}`;
  }

  if (context.intent === "largest_transactions" && Array.isArray(context.data.largestTransactions)) {
    const transactions = context.data.largestTransactions as {
      dateLabel: string;
      merchant: string;
      category: string;
      totalAmountLabel: string;
      items?: string[];
    }[];
    const first = transactions[0];
    const rows = transactions
      .slice(0, 3)
      .map((transaction, index) => `${index + 1}. ${transaction.merchant} - ${transaction.totalAmountLabel} pada ${transaction.dateLabel} (${transaction.category})`);

    return `Transaksi terbesar Anda pada ${context.period.periodLabel} adalah ${first.totalAmountLabel} di ${first.merchant} pada ${first.dateLabel}.\n\n${rows.join("\n")}`;
  }

  if (context.intent === "monthly_breakdown" && Array.isArray(context.data.monthlyBreakdown)) {
    const months = context.data.monthlyBreakdown as {
      monthLabel: string;
      totalExpenseLabel: string;
      transactionCount: number;
      topCategory: string | null;
    }[];
    const rows = months
      .slice(0, 12)
      .map((month) => `- ${month.monthLabel}: ${month.totalExpenseLabel} (${month.transactionCount} transaksi${month.topCategory ? `, terbesar ${month.topCategory}` : ""})`);

    return `Rincian pengeluaran per bulan:\n${rows.join("\n")}`;
  }

  if (context.intent === "merchant_breakdown") {
    if (context.data.merchant && typeof context.data.merchant === "object") {
      const merchant = context.data.merchant as {
        merchantName?: string;
        summary?: { totalExpenseLabel?: string; transactionCount?: number; periodLabel?: string };
      };

      return `Total belanja ${merchant.merchantName ?? "merchant tersebut"} pada ${merchant.summary?.periodLabel ?? context.period.periodLabel}: ${merchant.summary?.totalExpenseLabel ?? "Rp0"} dari ${merchant.summary?.transactionCount ?? 0} transaksi.`;
    }

    if (Array.isArray(context.data.merchants)) {
      const merchants = context.data.merchants as { merchantName: string; amountLabel: string; transactionCount: number }[];
      const topMerchants = merchants.slice(0, 3).map((merchant) => `- ${merchant.merchantName}: ${merchant.amountLabel} (${merchant.transactionCount} transaksi)`);

      return `Merchant terbesar pada ${context.period.periodLabel}:\n${topMerchants.join("\n")}`;
    }
  }

  if (context.intent === "item_price_history" && Array.isArray(context.data.itemPriceHistory)) {
    const items = context.data.itemPriceHistory as {
      itemName: string;
      merchant: string;
      dateLabel: string;
      unitPriceLabel?: string | null;
      totalPriceLabel?: string | null;
    }[];
    const rows = items.slice(0, 5).map((item) => `- ${item.itemName}, ${item.merchant}, ${item.dateLabel}: ${item.unitPriceLabel ?? item.totalPriceLabel ?? "Harga tidak tersedia"}`);

    return `Riwayat harga item yang ditemukan:\n${rows.join("\n")}`;
  }

  if (context.intent === "recent_transactions" && Array.isArray(context.data.recentTransactions)) {
    const transactions = context.data.recentTransactions as {
      dateLabel: string;
      merchant: string;
      category: string;
      totalAmountLabel: string;
    }[];
    const rows = transactions.map((transaction) => `- ${transaction.dateLabel}, ${transaction.merchant}, ${transaction.category}: ${transaction.totalAmountLabel}`);

    return `Transaksi terbaru:\n${rows.join("\n")}`;
  }

  if (context.intent === "budget_status" && Array.isArray(context.data.budgets)) {
    const budgets = context.data.budgets as {
      category: string;
      budgetAmountLabel: string;
      spentAmountLabel: string;
      remainingAmountLabel: string;
      status: string;
    }[];
    const rows = budgets.slice(0, 5).map((budget) => `- ${budget.category}: terpakai ${budget.spentAmountLabel} dari ${budget.budgetAmountLabel}, sisa ${budget.remainingAmountLabel} (${budget.status})`);

    return `Status anggaran:\n${rows.join("\n")}`;
  }

  if (context.intent === "unusual_transactions" && Array.isArray(context.data.unusualTransactions)) {
    const transactions = context.data.unusualTransactions as {
      dateLabel: string;
      merchant: string;
      totalAmountLabel: string;
      historicalAverageLabel: string;
    }[];
    const rows = transactions.map((transaction) => `- ${transaction.dateLabel}, ${transaction.merchant}: ${transaction.totalAmountLabel} (rata-rata historis ${transaction.historicalAverageLabel})`);

    return `Transaksi yang terlihat lebih tinggi dari kebiasaan:\n${rows.join("\n")}`;
  }

  if (context.intent === "savings_advice" && Array.isArray(context.data.categories)) {
    const categories = context.data.categories as { categoryName: string; amountLabel: string }[];
    const topCategories = categories.slice(0, 3).map((category) => category.categoryName).join(", ");

    return `Area yang bisa diperiksa untuk hemat bulan depan: ${topCategories}. Mulai dengan menetapkan batas belanja untuk kategori terbesar dan kurangi transaksi kecil yang tidak wajib.`;
  }

  if (context.intent === "upcoming_reminders" && Array.isArray(context.data.reminders)) {
    const reminders = context.data.reminders as {
      title: string;
      dueDate: string;
      amount: number | null;
      countdownLabel: string;
      type: string;
    }[];
    const summary = context.data.reminderSummary as { thisMonthAmount?: number; next30DaysAmount?: number; activeReminderCount?: number } | undefined;

    if (reminders.length === 0) {
      return "Tidak ada pengingat dalam waktu dekat.";
    }

    const total = reminders.reduce((sum, reminder) => sum + (reminder.amount ?? 0), 0);
    const rows = reminders
      .slice(0, 10)
      .map((reminder, index) => `${index + 1}. ${reminder.title} - ${reminder.amount ? formatAssistantCurrency(reminder.amount) : "Tanpa estimasi"} - ${formatAssistantDate(reminder.dueDate)} (${reminder.countdownLabel})`);

    return `Ada ${summary?.activeReminderCount ?? reminders.length} pengingat aktif dengan estimasi total ${formatAssistantCurrency(total)}:\n${rows.join("\n")}`;
  }

  if (context.intent === "upcoming_expense_summary" && context.data.reminderSummary && typeof context.data.reminderSummary === "object") {
    const summary = context.data.reminderSummary as {
      next30DaysAmount?: number;
      thisMonthAmount?: number;
      activeReminderCount?: number;
      overdueReminderCount?: number;
    };

    return `Estimasi pengeluaran wajib 30 hari ke depan ${formatAssistantCurrency(summary.next30DaysAmount ?? 0)}. Bulan ini ${formatAssistantCurrency(summary.thisMonthAmount ?? 0)} dari ${summary.activeReminderCount ?? 0} pengingat aktif, dengan ${summary.overdueReminderCount ?? 0} yang sudah lewat.`;
  }

  return "Data transaksi belum cukup untuk membuat analisis yang akurat.";
}
