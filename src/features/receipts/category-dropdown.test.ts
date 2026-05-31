import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { buildDefaultCategoriesForUser } from "@/features/categories/service";

import { TransactionReviewForm } from "./TransactionReviewForm";

test("receipt review category dropdown is populated for a newly initialized user", () => {
  const categories = buildDefaultCategoriesForUser("user-1").map((category, index) => ({
    id: `category-${index + 1}`,
    name: category.name
  }));
  const markup = renderToStaticMarkup(
    createElement(TransactionReviewForm, {
      receiptId: "receipt-1",
      parsedReceipt: {
        merchant: "Toko Contoh",
        transactionDate: "2026-05-31",
        totalAmount: 54_122,
        items: []
      },
      categories,
      mimeType: "image/jpeg"
    })
  );

  assert.match(markup, /<select[^>]*name="categoryId"/);
  assert.equal((markup.match(/<option/g) ?? []).length, categories.length);
  assert.match(markup, />Lainnya<\/option>/);
});

test("receipt review displays formatted Rupiah totals while submitting numeric values", () => {
  const markup = renderToStaticMarkup(
    createElement(TransactionReviewForm, {
      receiptId: "receipt-1",
      parsedReceipt: {
        merchant: "Toko Contoh",
        transactionDate: "2026-05-31",
        totalAmount: 124_665,
        items: [
          { name: "SEMANGKA BABY KUN", totalPrice: 12_425 },
          { name: "DIAMOND UHT F/CRM", totalPrice: 23_190 },
          { name: "365 FAC TISSUE2X1", totalPrice: 16_990 }
        ]
      },
      categories: [{ id: "category-1", name: "Lainnya" }],
      mimeType: "image/jpeg"
    })
  );

  assert.match(markup, /value="124\.665"/);
  assert.match(markup, /type="hidden" name="totalAmount" value="124665"/);
  assert.match(markup, /value="12\.425"/);
  assert.match(markup, /value="23\.190"/);
  assert.match(markup, /value="16\.990"/);
  assert.match(markup, /&quot;totalPrice&quot;:12425/);
  assert.match(markup, /&quot;totalPrice&quot;:23190/);
  assert.match(markup, /&quot;totalPrice&quot;:16990/);
});
