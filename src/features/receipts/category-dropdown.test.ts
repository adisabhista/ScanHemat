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
