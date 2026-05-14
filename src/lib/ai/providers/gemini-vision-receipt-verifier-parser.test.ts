import assert from "node:assert/strict";
import test from "node:test";

import { parseGeminiVisionVerificationText } from "@/lib/ai/providers/gemini-vision-receipt-verifier-parser";

const validPayload = {
  merchant: { value: "Nama Penjual ABC", confidence: 0.92, sourceText: "Nama Penjual ABC", reason: "Terlihat jelas." },
  transactionDate: { value: "2026-05-16", confidence: 0.91, sourceText: "16/05/26", reason: "Format DD/MM/YY." },
  totalAmount: { value: 54122, confidence: 0.96, sourceText: "Total Pembayaran Rp54.122", reason: "Total pembayaran akhir." },
  items: [
    {
      name: "Produk A",
      quantity: 1,
      unitPrice: 77600,
      totalPrice: 77600,
      confidence: 0.88,
      sourceText: "Produk A Rp77.600"
    }
  ],
  warnings: ["Total sebelumnya berbeda."],
  corrections: [
    {
      field: "totalAmount",
      oldValue: 77600,
      newValue: 54122,
      reason: "Baris Total Pembayaran lebih kuat daripada subtotal."
    }
  ]
};

test("parses valid Gemini Vision JSON", () => {
  const result = parseGeminiVisionVerificationText(JSON.stringify(validPayload));

  assert.equal(result.totalAmount.value, 54122);
  assert.equal(result.corrections[0].field, "totalAmount");
});

test("strips JSON code fences", () => {
  const result = parseGeminiVisionVerificationText(`\`\`\`json\n${JSON.stringify(validPayload)}\n\`\`\``);

  assert.equal(result.transactionDate.value, "2026-05-16");
});

test("throws on invalid JSON", () => {
  assert.throws(() => parseGeminiVisionVerificationText("not json"));
});

test("maps corrections without secret-like fields", () => {
  const result = parseGeminiVisionVerificationText(JSON.stringify(validPayload));

  assert.deepEqual(Object.keys(result.corrections[0]).sort(), ["field", "newValue", "oldValue", "reason"]);
  assert.equal(JSON.stringify(result).includes("GOOGLE_APPLICATION_CREDENTIALS"), false);
});
