import assert from "node:assert/strict";
import test from "node:test";

import { validateAndMergeAiResult } from "./index";
import type { AiReceiptExtraction } from "./types";
import type { ParsedReceipt } from "@/lib/parser/receipt-parser";

function buildAiResult(overrides: Partial<AiReceiptExtraction> = {}): AiReceiptExtraction {
  return {
    merchant: { value: "KFC", confidence: 0.95, sourceText: "KFC", reason: null },
    transactionDate: { value: "2026-05-13", confidence: 0.95, sourceText: "13/05/26", reason: null },
    totalAmount: { value: 50000, confidence: 0.95, sourceText: "TOTAL 50.000", reason: null },
    items: [{ name: "PAKET AYAM", quantity: 1, unitPrice: null, totalPrice: 50000, confidence: 0.9, sourceText: "PAKET AYAM 50.000" }],
    warnings: [],
    totalCandidates: [{ amount: 50000, sourceText: "TOTAL 50.000", reason: "Total akhir", isSelected: true }],
    category: { name: "Makanan", confidence: 0.92, reason: "KFC adalah restoran cepat saji." },
    ...overrides
  };
}

function buildFallbackResult(overrides: Partial<ParsedReceipt> = {}): ParsedReceipt {
  return {
    merchant: "PT LION SUPER INDO",
    transactionDate: "2026-05-13",
    totalAmount: 50000,
    items: [{ name: "365 FAC TISSUE", totalPrice: 50000 }],
    category: "Kebutuhan Rumah",
    categoryConfidence: 0.9,
    categoryReason: "Fallback parser",
    categorySource: "fallback",
    ...overrides
  };
}

test("uses valid Gemini category as the selected category", () => {
  const result = validateAndMergeAiResult(buildAiResult(), buildFallbackResult());

  assert.equal(result.category, "Makanan");
  assert.equal(result.categorySource, "gemini");
  assert.equal(result.categoryConfidence, 0.92);
});

test("shows warning when Gemini category confidence is low", () => {
  const result = validateAndMergeAiResult(
    buildAiResult({
      category: { name: "Makanan", confidence: 0.45, reason: "Merchant text is unclear." }
    }),
    buildFallbackResult()
  );

  assert.equal(result.category, "Makanan");
  assert.equal(result.categorySource, "gemini");
  assert.ok(result.warnings?.includes("Kategori kurang yakin. Mohon periksa kembali."));
});

test("falls back when Gemini category is missing", () => {
  const result = validateAndMergeAiResult(
    buildAiResult({
      merchant: { value: "PT LION SUPER INDO", confidence: 0.95, sourceText: "PT LION SUPER INDO", reason: null },
      items: [{ name: "365 FAC TISSUE", quantity: 1, unitPrice: null, totalPrice: 50000, confidence: 0.9, sourceText: "365 FAC TISSUE" }],
      category: { name: null, confidence: 0, reason: null }
    }),
    buildFallbackResult()
  );

  assert.equal(result.category, "Kebutuhan Rumah");
  assert.equal(result.categorySource, "fallback");
});

test("falls back when Gemini returns Semua kategori", () => {
  const result = validateAndMergeAiResult(
    buildAiResult({
      merchant: { value: "PT LION SUPER INDO", confidence: 0.95, sourceText: "PT LION SUPER INDO", reason: null },
      items: [{ name: "365 FAC TISSUE", quantity: 1, unitPrice: null, totalPrice: 50000, confidence: 0.9, sourceText: "365 FAC TISSUE" }],
      category: { name: "Semua kategori", confidence: 0.99, reason: "Invalid UI filter option." }
    }),
    buildFallbackResult()
  );

  assert.equal(result.category, "Kebutuhan Rumah");
  assert.equal(result.categorySource, "fallback");
  assert.notEqual(result.category, "Semua kategori");
});
