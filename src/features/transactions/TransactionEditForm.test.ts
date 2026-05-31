import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Prisma } from "@prisma/client";

import { TransactionEditForm } from "@/features/transactions/TransactionEditForm";

test("transaction edit form renders labeled items and serializes numeric Rupiah values", () => {
  const markup = renderToStaticMarkup(
    createElement(TransactionEditForm, {
      categories: [{
        id: "category-1",
        name: "Lainnya",
        color: "#64748b",
        userId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        isDefault: false
      }],
      transaction: {
        id: "transaction-1",
        merchant: "Toko Contoh",
        transactionDate: new Date("2026-05-31"),
        categoryId: "category-1",
        totalAmount: new Prisma.Decimal(54055),
        notes: null,
        source: "MANUAL",
        needsReview: false,
        reviewReason: null,
        items: [
          {
            id: "item-1",
            transactionId: "transaction-1",
            name: "DIAMOND UHT F/CRM",
            quantity: null,
            unitPrice: new Prisma.Decimal(21990),
            totalPrice: new Prisma.Decimal(21990),
            createdAt: new Date()
          }
        ]
      }
    })
  );

  assert.match(markup, /Nama Item/);
  assert.match(markup, /Total Item/);
  assert.match(markup, /value="54\.055"/);
  assert.match(markup, /value="21\.990"/);
  assert.match(markup, /&quot;unitPrice&quot;:21990/);
  assert.match(markup, /&quot;totalPrice&quot;:21990/);
});
