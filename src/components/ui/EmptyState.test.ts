import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EmptyState } from "./EmptyState";

test("empty state renders Indonesian title and description", () => {
  const markup = renderToStaticMarkup(
    createElement(EmptyState, {
      title: "Belum ada transaksi",
      description: "Unggah struk pertama Anda untuk mulai mencatat pengeluaran"
    })
  );

  assert.match(markup, /Belum ada transaksi/);
  assert.match(markup, /Unggah struk pertama Anda/);
});
