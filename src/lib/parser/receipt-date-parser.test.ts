import assert from "node:assert/strict";
import test from "node:test";

import { parseReceiptDateText } from "./receipt-date-parser";

test("parses Indonesian DD/MM/YY and DD-MM-YY receipt dates", () => {
  const cases = [
    { raw: "16/05/26", expected: "2026-05-16", pattern: "DD/MM/YY" },
    { raw: "16-05-26", expected: "2026-05-16", pattern: "DD-MM-YY" },
    { raw: "06/05/26", expected: "2026-05-06", pattern: "DD/MM/YY" },
    { raw: "05/06/26", expected: "2026-06-05", pattern: "DD/MM/YY" },
    { raw: "01-05-26", expected: "2026-05-01", pattern: "DD-MM-YY" },
    { raw: "31/12/26", expected: "2026-12-31", pattern: "DD/MM/YY" }
  ];

  for (const item of cases) {
    const result = parseReceiptDateText(item.raw);

    assert.equal(result.isoDate, item.expected);
    assert.equal(result.debug.detectedPattern, item.pattern);
  }
});

test("parses explicit YYYY-MM-DD as year-month-day", () => {
  const result = parseReceiptDateText("2026-05-16");

  assert.equal(result.isoDate, "2026-05-16");
  assert.equal(result.debug.detectedPattern, "YYYY-MM-DD");
  assert.equal(result.debug.parsedYear, 2026);
  assert.equal(result.debug.parsedMonth, 5);
  assert.equal(result.debug.parsedDay, 16);
});

test("rejects non-transaction date lines", () => {
  const result = parseReceiptDateText("Tanggal Pengukuhan : 06-06-97");

  assert.equal(result.isoDate, undefined);
  assert.equal(result.debug.rejectionReason, "Baris berisi tanggal non-transaksi.");
});

test("rejects impossible calendar dates", () => {
  const result = parseReceiptDateText("31/02/26");

  assert.equal(result.isoDate, undefined);
  assert.equal(result.debug.rejectionReason, "Tanggal tidak mungkin untuk bulan tersebut.");
});
