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
  assert.equal(insight.title, "Kategori Lainnya masih besar");
  assert.equal(insight.message, "Rapikan kategori agar laporan pengeluaran lebih akurat.");
  assert.equal(insight.actionHref, "/transactions?categoryId=other");
  assert.equal(insight.actionLabel, "Tinjau Transaksi Lainnya");
});

test("dashboard insight warns when Lainnya has too many transactions", () => {
  const insight = getDashboardInsight(
    [
      { id: "other", name: "Lainnya", total: 100_000, transactionCount: 5 },
      { id: "food", name: "Makanan", total: 600_000, transactionCount: 4 }
    ],
    700_000,
    9,
    true
  );

  assert.equal(insight.tone, "warning");
  assert.equal(insight.secondaryActionHref, "/transactions?needsReview=1");
  assert.equal(insight.secondaryActionLabel, "Lihat yang Perlu Dicek");
});

test("dashboard insight hides Lainnya warning when it is small", () => {
  const insight = getDashboardInsight(
    [
      { id: "other", name: "Lainnya", total: 50_000, transactionCount: 1 },
      { id: "food", name: "Makanan", total: 600_000, transactionCount: 5 }
    ],
    650_000,
    6
  );

  assert.notEqual(insight.title, "Kategori Lainnya masih besar");
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
