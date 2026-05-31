import assert from "node:assert/strict";
import test from "node:test";

import { formatRupiahInput, parseRupiahInput } from "@/lib/format/rupiah-input";

test("formats Rupiah input values with Indonesian thousand separators", () => {
  assert.equal(formatRupiahInput(124_665), "124.665");
  assert.equal(formatRupiahInput("124665"), "124.665");
  assert.equal(formatRupiahInput("12.465"), "12.465");
});

test("parses formatted Rupiah input values as numeric rupiah", () => {
  assert.equal(parseRupiahInput("124.665"), 124_665);
  assert.equal(parseRupiahInput("Rp124.665"), 124_665);
  assert.equal(parseRupiahInput("124,665"), 124_665);
  assert.equal(parseRupiahInput(""), undefined);
});

test("rejects negative Rupiah input values", () => {
  assert.equal(parseRupiahInput("-12.465"), undefined);
  assert.equal(formatRupiahInput(-12_465), "");
});
