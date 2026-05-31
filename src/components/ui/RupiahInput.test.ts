import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { RupiahInput } from "@/components/ui/RupiahInput";

test("renders a formatted visible Rupiah value and numeric hidden submission value", () => {
  const markup = renderToStaticMarkup(createElement(RupiahInput, { defaultValue: "12.465", label: "Total", name: "totalAmount" }));

  assert.match(markup, /type="text" value="12\.465"/);
  assert.match(markup, /type="hidden" name="totalAmount" value="12465"/);
});
