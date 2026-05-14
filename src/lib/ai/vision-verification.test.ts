import assert from "node:assert/strict";
import test from "node:test";

import { mergeVisionVerificationResult, shouldSuggestVisionVerification } from "@/lib/ai/vision-verification";
import type { AiReceiptVisionVerification } from "@/lib/ai/types";
import type { ParsedReceipt } from "@/lib/parser/receipt-parser";

test("low total confidence triggers vision suggestion", () => {
  assert.equal(
    shouldSuggestVisionVerification(
      buildParsedReceipt({
        confidence: "high",
        fieldConfidences: { totalAmount: 0.7, transactionDate: 0.95, merchant: 0.95 }
      })
    ),
    true
  );
});

test("conflicting totals trigger vision suggestion", () => {
  assert.equal(
    shouldSuggestVisionVerification(
      buildParsedReceipt({
        confidence: "high",
        totalCandidates: [
          { amount: 54122, sourceText: "Total Pembayaran Rp54.122", isSelected: true, reason: "Total akhir." },
          { amount: 77600, sourceText: "Subtotal Rp77.600", isSelected: false, reason: "Subtotal." }
        ]
      })
    ),
    true
  );
});

test("high confidence receipt does not trigger vision suggestion", () => {
  assert.equal(
    shouldSuggestVisionVerification(
      buildParsedReceipt({
        confidence: "high",
        fieldConfidences: { totalAmount: 0.95, transactionDate: 0.95, merchant: 0.95 },
        warnings: undefined,
        totalCandidates: [{ amount: 50000, sourceText: "TOTAL 50.000", isSelected: true, reason: "Total akhir." }]
      })
    ),
    false
  );
});

test("Shopee visual correction applies Total Pembayaran amount", () => {
  const result = mergeVisionVerificationResult(
    buildParsedReceipt({
      totalAmount: 77600,
      totalCandidates: [
        { amount: 77600, sourceText: "Subtotal Rp77.600", isSelected: true, reason: "Subtotal produk." },
        { amount: 54122, sourceText: "Total Pembayaran Rp54.122", isSelected: false, reason: "Total pembayaran." }
      ]
    }),
    buildVerification({
      totalAmount: {
        value: 54122,
        confidence: 0.96,
        sourceText: "Total Pembayaran Rp54.122",
        reason: "Baris total pembayaran akhir."
      },
      corrections: [
        {
          field: "totalAmount",
          oldValue: 77600,
          newValue: 54122,
          reason: "Total Pembayaran Rp54.122 lebih kuat daripada Subtotal Rp77.600."
        }
      ]
    })
  );

  assert.equal(result.totalAmount, 54122);
  assert.equal(result.visionCorrections?.[0].newValue, 54122);
});

test("visual date correction keeps 16/05/26 as 2026-05-16", () => {
  const result = mergeVisionVerificationResult(
    buildParsedReceipt({ transactionDate: "2016-05-26" }),
    buildVerification({
      transactionDate: {
        value: "2026-05-16",
        confidence: 0.95,
        sourceText: "16/05/26",
        reason: "Format DD/MM/YY."
      }
    })
  );

  assert.equal(result.transactionDate, "2026-05-16");
});

function buildParsedReceipt(overrides: Partial<ParsedReceipt> = {}): ParsedReceipt {
  return {
    merchant: "Toko ABC",
    transactionDate: "2026-05-13",
    totalAmount: 50000,
    items: [],
    category: "Lainnya",
    confidence: "high",
    fieldConfidences: { merchant: 0.95, transactionDate: 0.95, totalAmount: 0.95 },
    ...overrides
  };
}

function buildVerification(overrides: Partial<AiReceiptVisionVerification> = {}): AiReceiptVisionVerification {
  return {
    merchant: { value: "Toko ABC", confidence: 0.95, sourceText: "Toko ABC", reason: null },
    transactionDate: { value: "2026-05-13", confidence: 0.95, sourceText: "13/05/26", reason: null },
    totalAmount: { value: 50000, confidence: 0.95, sourceText: "TOTAL 50.000", reason: null },
    items: [],
    warnings: [],
    corrections: [],
    ...overrides
  };
}
