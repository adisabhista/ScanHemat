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
  assert.match(markup, /Harga satuan boleh kosong jika tidak terbaca dari struk\./);
  assert.match(markup, /sm:grid-cols-2/);
  assert.match(markup, /xl:grid-cols-\[minmax\(280px,1fr\)_96px_150px_150px_88px\]/);
});

test("simple item with missing unit price shows an empty disabled field", () => {
  const item = { name: "DIAMOND UHT F/CRM", quantity: "1", totalPrice: "21990" };
  const markup = renderToStaticMarkup(
    createElement(TransactionItemsEditor, {
      items: [item],
      onItemsChange: () => undefined
    })
  );

  assert.equal(shouldShowUnitPrice(item), false);
  assert.match(markup, /aria-label="Harga Satuan" disabled="" placeholder="" value=""/);
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
  assert.match(markup, /h-10 text-right/);
});
