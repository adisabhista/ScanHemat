import assert from "node:assert/strict";
import test from "node:test";

import { getDashboardInsight } from "./insights";

test("dashboard insight handles empty data", () => {
  const insight = getDashboardInsight([], 0);

  assert.equal(insight.title, "Insight Bulan Ini");
  assert.equal(insight.tone, "info");
  assert.match(insight.message, /Belum ada transaksi/);
});

test("dashboard insight warns when Lainnya is too large", () => {
  const insight = getDashboardInsight(
    [
      { id: "other", name: "Lainnya", total: 400_000 },
      { id: "food", name: "Makanan", total: 600_000 }
    ],
    1_000_000
  );

  assert.equal(insight.tone, "warning");
  assert.equal(insight.message, "Kategori Lainnya masih besar. Tinjau transaksi agar laporan lebih akurat.");
  assert.equal(insight.actionHref, "/transactions?categoryId=other");
  assert.equal(insight.actionLabel, "Tinjau transaksi Lainnya");
});

test("dashboard insight describes the largest category", () => {
  const insight = getDashboardInsight(
    [
      { id: "food", name: "Makanan", total: 250_000 },
      { id: "transport", name: "Transportasi", total: 100_000 }
    ],
    500_000
  );

  assert.equal(insight.tone, "warning");
  assert.match(insight.message, /Makanan menyumbang 50%/);
});
