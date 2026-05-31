import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TransactionItemsEditor, shouldShowUnitPrice } from "@/features/transactions/TransactionItemsEditor";

test("transaction item editor renders clear desktop headers", () => {
  const markup = renderToStaticMarkup(
    createElement(TransactionItemsEditor, {
      items: [{ name: "DIAMOND UHT F/CRM", quantity: "1", unitPrice: "21990", totalPrice: "21990" }],
      onItemsChange: () => undefined
    })
  );

  assert.match(markup, /Nama Item/);
  assert.match(markup, /Qty/);
  assert.match(markup, /Harga Satuan/);
  assert.match(markup, /Total Item/);
  assert.match(markup, /Aksi/);
});

test("simple one-unit item shows only the total item money field", () => {
  const item = { name: "DIAMOND UHT F/CRM", quantity: "1", unitPrice: "21990", totalPrice: "21990" };
  const markup = renderToStaticMarkup(
    createElement(TransactionItemsEditor, {
      items: [item],
      onItemsChange: () => undefined
    })
  );

  assert.equal(shouldShowUnitPrice(item), false);
  assert.doesNotMatch(markup, /aria-label="Harga Satuan"/);
  assert.match(markup, /aria-label="Total Item"/);
  assert.match(markup, /value="21\.990"/);
});

test("quantity item shows formatted unit and total price fields", () => {
  const item = { name: "AIR MINERAL", quantity: "2", unitPrice: "21990", totalPrice: "43980" };
  const markup = renderToStaticMarkup(
    createElement(TransactionItemsEditor, {
      items: [item],
      onItemsChange: () => undefined
    })
  );

  assert.equal(shouldShowUnitPrice(item), true);
  assert.match(markup, /aria-label="Harga Satuan"/);
  assert.match(markup, /aria-label="Total Item"/);
  assert.match(markup, /value="21\.990"/);
  assert.match(markup, /value="43\.980"/);
});
