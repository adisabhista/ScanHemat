import assert from "node:assert/strict";
import test from "node:test";

import { getReceiptReviewState } from "./review-state";

test("low OCR confidence marks receipt as needs review", () => {
  const state = getReceiptReviewState({ items: [], confidence: "high" }, { lowOcrConfidence: true });

  assert.equal(state.needsReview, true);
  assert.ok(state.reasons.includes("Kualitas OCR rendah."));
});

test("conflicting totals mark receipt as needs review", () => {
  const state = getReceiptReviewState({
    items: [],
    totalCandidates: [
      { amount: 54000, sourceText: "TOTAL 54.000", isSelected: true, reason: "Total akhir." },
      { amount: 76000, sourceText: "SUBTOTAL 76.000", isSelected: false, reason: "Subtotal." }
    ]
  });

  assert.equal(state.needsReview, true);
  assert.ok(state.reasons.includes("Ada beberapa kandidat total transaksi."));
});

test("low-confidence Lainnya category marks receipt as needs review", () => {
  const state = getReceiptReviewState({
    items: [],
    category: "Lainnya",
    categoryConfidence: 0.4
  });

  assert.equal(state.needsReview, true);
  assert.ok(state.reasons.includes("Kategori Lainnya perlu diperiksa."));
});
