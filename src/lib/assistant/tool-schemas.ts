import type { FunctionDeclaration } from "@google/genai";
import { z } from "zod";

export const assistantToolNames = [
  "getSpendingSummary",
  "getCategoryBreakdown",
  "getMerchantBreakdown",
  "getLargestTransactions",
  "getMonthlyBreakdown",
  "getRecentTransactions",
  "getSmallFrequentTransactions",
  "getBudgetStatus",
  "getItemPriceHistory",
  "getUpcomingReminders",
  "getUpcomingExpenseSummary"
] as const;

export type AssistantFunctionToolName = (typeof assistantToolNames)[number];

const periodEnum = ["month", "year", "all", "custom"] as const;

export const assistantPeriodArgsSchema = z.object({
  period: z.enum(periodEnum).default("month"),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export const spendingSummaryArgsSchema = assistantPeriodArgsSchema;
export const categoryBreakdownArgsSchema = assistantPeriodArgsSchema.extend({
  limit: z.coerce.number().int().min(1).max(20).optional()
});
export const merchantBreakdownArgsSchema = assistantPeriodArgsSchema.extend({
  limit: z.coerce.number().int().min(1).max(20).optional()
});
export const largestTransactionsArgsSchema = assistantPeriodArgsSchema.extend({
  limit: z.coerce.number().int().min(1).max(20).optional()
});
export const monthlyBreakdownArgsSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100)
});
export const recentTransactionsArgsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional()
});
export const smallFrequentTransactionsArgsSchema = assistantPeriodArgsSchema.extend({
  thresholdAmount: z.coerce.number().positive().max(100000000).optional()
});
export const budgetStatusArgsSchema = z.object({
  period: z.enum(["month", "year"]).default("month"),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional()
});
export const itemPriceHistoryArgsSchema = z.object({
  keyword: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).optional()
});
export const upcomingRemindersArgsSchema = z.object({
  period: z.enum(["week", "month", "next30days", "all"]).default("next30days"),
  type: z
    .enum(["SUBSCRIPTION", "BILL", "VEHICLE_TAX", "STNK", "SIM", "WARRANTY", "LICENSE", "DOCUMENT", "OTHER"])
    .optional()
});

const periodProperties = {
  period: {
    type: "string",
    enum: periodEnum,
    description: "Period to query. Use month by default when unspecified."
  },
  month: { type: "number", description: "Month number 1-12 for month period." },
  year: { type: "number", description: "Four digit year." },
  startDate: { type: "string", description: "Start date for custom period, YYYY-MM-DD." },
  endDate: { type: "string", description: "End date for custom period, YYYY-MM-DD." }
};

function periodParameters(extra: Record<string, unknown> = {}, required: string[] = []) {
  return {
    type: "object",
    properties: {
      ...periodProperties,
      ...extra
    },
    required
  };
}

export const assistantFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: "getSpendingSummary",
    description: "Get total spending and transaction count for a period.",
    parametersJsonSchema: periodParameters()
  },
  {
    name: "getCategoryBreakdown",
    description: "Get spending grouped by category for a period.",
    parametersJsonSchema: periodParameters({
      limit: { type: "number", description: "Maximum number of categories to return." }
    })
  },
  {
    name: "getMerchantBreakdown",
    description: "Get spending grouped by merchant for a period.",
    parametersJsonSchema: periodParameters({
      limit: { type: "number", description: "Maximum number of merchants to return." }
    })
  },
  {
    name: "getLargestTransactions",
    description: "Get largest/highest transactions for a period.",
    parametersJsonSchema: periodParameters({
      limit: { type: "number", description: "Maximum number of transactions to return." }
    })
  },
  {
    name: "getMonthlyBreakdown",
    description: "Get monthly spending summary for a year.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        year: { type: "number", description: "Four digit year." }
      },
      required: ["year"]
    }
  },
  {
    name: "getRecentTransactions",
    description: "Get recent transactions.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of transactions to return." }
      }
    }
  },
  {
    name: "getSmallFrequentTransactions",
    description: "Find frequent small transactions below a threshold.",
    parametersJsonSchema: periodParameters({
      thresholdAmount: { type: "number", description: "Small transaction threshold. Default is 30000." }
    })
  },
  {
    name: "getBudgetStatus",
    description: "Get spending versus budget by category.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["month", "year"], description: "Budget period." },
        month: { type: "number", description: "Month number 1-12 for month period." },
        year: { type: "number", description: "Four digit year." }
      }
    }
  },
  {
    name: "getItemPriceHistory",
    description: "Get price history for items matching a keyword.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Item keyword to search for." },
        limit: { type: "number", description: "Maximum number of item rows to return." }
      },
      required: ["keyword"]
    }
  },
  {
    name: "getUpcomingReminders",
    description: "Get active upcoming reminders for subscriptions, bills, vehicle tax, STNK, SIM, warranties, licenses, documents, and other obligations.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["week", "month", "next30days", "all"], description: "Reminder period to query." },
        type: {
          type: "string",
          enum: ["SUBSCRIPTION", "BILL", "VEHICLE_TAX", "STNK", "SIM", "WARRANTY", "LICENSE", "DOCUMENT", "OTHER"],
          description: "Optional reminder type filter."
        }
      }
    }
  },
  {
    name: "getUpcomingExpenseSummary",
    description: "Get mandatory upcoming expense totals and reminder counts.",
    parametersJsonSchema: {
      type: "object",
      properties: {}
    }
  }
];
