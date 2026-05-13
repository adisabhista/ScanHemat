import assert from "node:assert/strict";
import test from "node:test";

import { formatAssistantCurrency, formatAssistantDate } from "./format";
import { generateAssistantAgentAnswer } from "./gemini-agent";
import { classifyAssistantIntent, resolveAssistantIntent } from "./intent";
import { parseAssistantPeriod } from "./period";
import { buildDeterministicAssistantAnswer } from "./service";
import { assistantFunctionDeclarations, categoryBreakdownArgsSchema } from "./tool-schemas";
import {
  buildAssistantTransactionWhere,
  buildCategoryBreakdown,
  executeAssistantTool,
  buildLargestTransactions,
  buildMerchantBreakdown,
  buildMonthlyBreakdown,
  buildSmallFrequentTransactions,
  type AssistantTransactionRecord
} from "./tools";
import type { AssistantContext } from "./types";

const transactions: AssistantTransactionRecord[] = [
  {
    transactionDate: new Date(Date.UTC(2026, 4, 1)),
    merchant: "Shopee",
    totalAmount: 54122,
    category: { name: "Kebutuhan Rumah" },
    items: [{ name: "Pasta Gigi Colgate", quantity: 1, unitPrice: 77600, totalPrice: 77600 }]
  },
  {
    transactionDate: new Date(Date.UTC(2026, 4, 2)),
    merchant: "KFC",
    totalAmount: 28000,
    category: { name: "Makanan" },
    items: [{ name: "Paket Ayam", quantity: 1, unitPrice: 28000, totalPrice: 28000 }]
  },
  {
    transactionDate: new Date(Date.UTC(2026, 4, 3)),
    merchant: "Indomaret",
    totalAmount: 18000,
    category: { name: "Kebutuhan Rumah" },
    items: [{ name: "Air Mineral", quantity: 2, unitPrice: 9000, totalPrice: 18000 }]
  }
];

test("classifies spending summary intent", () => {
  assert.equal(classifyAssistantIntent("Berapa total pengeluaran bulan ini?").intent, "spending_summary");
});

test("classifies category breakdown intent", () => {
  assert.equal(classifyAssistantIntent("Kategori apa yang paling besar?").intent, "category_breakdown");
});

test("classifies merchant breakdown intent", () => {
  const result = classifyAssistantIntent("Berapa total belanja Shopee bulan ini?");

  assert.equal(result.intent, "merchant_breakdown");
  assert.equal(result.merchantName, "Shopee");
});

test("classifies small frequent transaction intent", () => {
  const result = classifyAssistantIntent("Apa transaksi kecil yang sering terjadi di bawah Rp30.000?");

  assert.equal(result.intent, "small_frequent_transactions");
  assert.equal(result.thresholdAmount, 30000);
});

test("classifies item price history intent", () => {
  const result = classifyAssistantIntent("Riwayat harga item pasta gigi");

  assert.equal(result.intent, "item_price_history");
  assert.equal(result.itemKeyword, "pasta gigi");
});

test("classifies largest transactions intent", () => {
  assert.equal(classifyAssistantIntent("analisa transaksi apa yang paling tinggi").intent, "largest_transactions");
  assert.equal(classifyAssistantIntent("pengeluaran terbesar bulan ini").intent, "largest_transactions");
});

test("resolves category breakdown intent", () => {
  assert.equal(resolveAssistantIntent([{ role: "user", content: "Kategori apa yang paling besar?" }]).intent, "category_breakdown");
});

test("resolves follow-up month comparison from previous category topic", () => {
  const result = resolveAssistantIntent([
    { role: "user", content: "Kategori apa yang paling besar?" },
    { role: "assistant", content: "Kategori terbesar adalah Kebutuhan Rumah." },
    { role: "user", content: "untuk bulan lainnya?" }
  ]);

  assert.equal(result.intent, "monthly_breakdown");
  assert.equal(result.previousIntent, "category_breakdown");
});

test("resolves year period follow-up from previous summary topic", () => {
  const result = resolveAssistantIntent([
    { role: "user", content: "Berapa total pengeluaran bulan ini?" },
    { role: "assistant", content: "Total pengeluaran Mei 2026 adalah Rp100.000." },
    { role: "user", content: "untuk keseluruhan tahun ini?" }
  ]);

  assert.equal(result.intent, "spending_summary");
  assert.equal(result.previousIntent, "spending_summary");
});

test("asks clarification for unclear follow-up without previous context", () => {
  const result = resolveAssistantIntent([{ role: "user", content: "untuk bulan lainnya?" }]);

  assert.equal(result.needsClarification, true);
  assert.equal(result.clarifyingQuestion, "Maksud Anda ingin melihat bulan sebelumnya, semua bulan, atau bulan tertentu?");
});

test("resolves previous month category question as category breakdown", () => {
  const result = resolveAssistantIntent([{ role: "user", content: "bulan lalu kategori terbesar apa?" }]);
  const period = parseAssistantPeriod("bulan lalu kategori terbesar apa?", new Date(Date.UTC(2026, 4, 13)));

  assert.equal(result.intent, "category_breakdown");
  assert.equal(period.period, "month");
  assert.equal(period.month, 4);
  assert.equal(period.year, 2026);
});

test("resolves Indonesian month phrases", () => {
  const now = new Date(Date.UTC(2026, 4, 13));
  const may = parseAssistantPeriod("mei 2026", now);
  const march = parseAssistantPeriod("maret", now);

  assert.equal(may.period, "month");
  assert.equal(may.month, 5);
  assert.equal(may.year, 2026);
  assert.equal(march.period, "month");
  assert.equal(march.month, 3);
  assert.equal(march.year, 2026);
});

test("returns insufficient data answer when context has no data", () => {
  const context: AssistantContext = {
    intent: "unusual_transactions",
    tools: ["getUnusualTransactions"],
    period: { period: "month", month: 5, year: 2026, periodLabel: "Mei 2026" },
    data: { unusualTransactions: [] },
    hasEnoughData: false
  };

  assert.equal(buildDeterministicAssistantAnswer(context), "Data transaksi belum cukup untuk membuat analisis yang akurat.");
});

test("returns no transactions answer for empty valid query result", () => {
  const context: AssistantContext = {
    intent: "largest_transactions",
    tools: ["getLargestTransactions"],
    period: { period: "month", month: 5, year: 2026, periodLabel: "Mei 2026" },
    data: { largestTransactions: [] },
    hasEnoughData: false
  };

  assert.equal(buildDeterministicAssistantAnswer(context), "Saya tidak menemukan transaksi pada periode tersebut.");
});

test("builds authenticated user-scoped transaction where clause", () => {
  const where = buildAssistantTransactionWhere("user-1", { period: "year", year: 2026, month: 1 });

  assert.equal(where.userId, "user-1");
  assert.deepEqual(where.transactionDate, {
    gte: new Date(Date.UTC(2026, 0, 1)),
    lt: new Date(Date.UTC(2027, 0, 1))
  });
});

test("formats Rupiah amounts", () => {
  assert.equal(formatAssistantCurrency(54122), "Rp54.122");
});

test("formats Indonesian dates", () => {
  assert.equal(formatAssistantDate("2026-05-01"), "1 Mei 2026");
});

test("builds category breakdown with percentages", () => {
  const breakdown = buildCategoryBreakdown(transactions);

  assert.equal(breakdown[0].categoryName, "Kebutuhan Rumah");
  assert.equal(breakdown[0].amount, 72122);
  assert.equal(breakdown[0].percentage, 72);
});

test("builds merchant breakdown", () => {
  const breakdown = buildMerchantBreakdown(transactions);

  assert.equal(breakdown[0].merchantName, "Shopee");
  assert.equal(breakdown[0].amount, 54122);
  assert.equal(breakdown[0].transactionCount, 1);
});

test("builds small frequent transaction summary with default threshold", () => {
  const summary = buildSmallFrequentTransactions(transactions);

  assert.equal(summary.thresholdAmount, 30000);
  assert.equal(summary.count, 2);
  assert.equal(summary.totalAmount, 46000);
});

test("builds largest transactions", () => {
  const largest = buildLargestTransactions(transactions, 2);

  assert.equal(largest.length, 2);
  assert.equal(largest[0].merchant, "Shopee");
  assert.equal(largest[0].totalAmount, 54122);
});

test("builds monthly breakdown with top category", () => {
  const breakdown = buildMonthlyBreakdown(transactions, 2026);

  assert.equal(breakdown.length, 1);
  assert.equal(breakdown[0].month, 5);
  assert.equal(breakdown[0].transactionCount, 3);
  assert.equal(breakdown[0].topCategory, "Kebutuhan Rumah");
});

test("declares required Gemini function tools", () => {
  const names = assistantFunctionDeclarations.map((declaration) => declaration.name);

  assert.ok(names.includes("getSpendingSummary"));
  assert.ok(names.includes("getCategoryBreakdown"));
  assert.ok(names.includes("getLargestTransactions"));
  assert.ok(names.includes("getMonthlyBreakdown"));
  assert.ok(names.includes("getItemPriceHistory"));
});

test("validates function call period arguments", () => {
  const parsed = categoryBreakdownArgsSchema.parse({ period: "month", month: 5, year: 2026, limit: 3 });

  assert.equal(parsed.period, "month");
  assert.equal(parsed.month, 5);
  assert.equal(parsed.year, 2026);
  assert.equal(parsed.limit, 3);
  assert.throws(() => categoryBreakdownArgsSchema.parse({ period: "month", month: 13, year: 2026 }));
});

test("rejects unknown assistant tool execution", async () => {
  await assert.rejects(() => executeAssistantTool("user-1", "runSql", {}, new Date(Date.UTC(2026, 4, 14))), /Unknown assistant tool/);
});

test("uses deterministic fallback when Gemini config is unavailable", async () => {
  const response = await generateAssistantAgentAnswer({
    userId: "user-1",
    messages: [{ role: "user", content: "untuk bulan lainnya?" }],
    now: new Date(Date.UTC(2026, 4, 14)),
    geminiConfig: null
  });

  assert.equal(response.fallbackUsed, true);
  assert.equal(response.geminiCalled, false);
  assert.equal(response.answer, "Maksud Anda ingin melihat bulan sebelumnya, semua bulan, atau bulan tertentu?");
});

test("executes mocked Gemini function calls and returns final answer", async () => {
  const functionCall = {
    id: "call-1",
    name: "getCategoryBreakdown",
    args: { period: "year", year: 2026, limit: 3 }
  };
  const calls: unknown[] = [];
  const geminiConfig = {
    model: "gemini-2.5-flash",
    client: {
      models: {
        async generateContent(params: unknown) {
          calls.push(params);

          if (calls.length === 1) {
            return {
              functionCalls: [functionCall],
              candidates: [{ content: { role: "model", parts: [{ functionCall }] } }]
            } as never;
          }

          return {
            functionCalls: undefined,
            text: "Kategori terbesar tahun ini adalah Kebutuhan Rumah."
          } as never;
        }
      }
    }
  };
  const executedTools: Array<{ userId: string; name: string; args: unknown }> = [];
  const response = await generateAssistantAgentAnswer({
    userId: "user-1",
    messages: [
      { role: "user", content: "Kategori apa yang paling besar?" },
      { role: "assistant", content: "Kategori terbesar adalah Kebutuhan Rumah." },
      { role: "user", content: "untuk keseluruhan tahun ini?" }
    ],
    now: new Date(Date.UTC(2026, 4, 14)),
    geminiConfig,
    async executeTool(userId, name, args) {
      executedTools.push({ userId, name, args });
      return [{ categoryName: "Kebutuhan Rumah", amount: 100000, percentage: 50, transactionCount: 2 }];
    }
  });

  assert.equal(response.geminiCalled, true);
  assert.equal(response.fallbackUsed, false);
  assert.equal(response.answer, "Kategori terbesar tahun ini adalah Kebutuhan Rumah.");
  assert.equal(executedTools[0].userId, "user-1");
  assert.equal(executedTools[0].name, "getCategoryBreakdown");
  assert.deepEqual(executedTools[0].args, { period: "year", year: 2026, limit: 3 });
  assert.equal(response.toolCalls[0].resultCount, 1);
});
