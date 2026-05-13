import type { TransactionFilters } from "@/features/transactions/period-filter";

export type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantIntent =
  | "spending_summary"
  | "category_breakdown"
  | "merchant_breakdown"
  | "largest_transactions"
  | "monthly_breakdown"
  | "recent_transactions"
  | "item_price_history"
  | "budget_status"
  | "small_frequent_transactions"
  | "unusual_transactions"
  | "savings_advice"
  | "follow_up";

export type AssistantIntentResult = {
  intent: AssistantIntent;
  previousIntent?: AssistantIntent;
  needsClarification?: boolean;
  clarifyingQuestion?: string;
  merchantName?: string;
  itemKeyword?: string;
  thresholdAmount?: number;
};

export type AssistantPeriod = TransactionFilters & {
  periodLabel: string;
  isExplicit?: boolean;
};

export type AssistantToolName =
  | "getSpendingSummary"
  | "getCategoryBreakdown"
  | "getMerchantBreakdown"
  | "getLargestTransactions"
  | "getMonthlyBreakdown"
  | "getRecentTransactions"
  | "getTransactionsByMerchant"
  | "getItemPriceHistory"
  | "getBudgetStatus"
  | "getSmallFrequentTransactions"
  | "getUnusualTransactions";

export type AssistantContext = {
  intent: AssistantIntent;
  tools: AssistantToolName[];
  period: AssistantPeriod;
  data: Record<string, unknown>;
  hasEnoughData: boolean;
  needsClarification?: boolean;
  clarifyingQuestion?: string;
  previousIntent?: AssistantIntent;
  resultCount?: number;
};
