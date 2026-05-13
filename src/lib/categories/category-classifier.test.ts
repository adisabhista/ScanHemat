import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyReceiptCategory,
  getGeminiCategoryClassification,
  normalizeTransactionCategoryName
} from "./category-classifier";

test("classifies receipt categories from merchant and item keywords", () => {
  const cases = [
    { merchant: "PT LION SUPER INDO", items: ["SEMANGKA BABY", "365 FAC TISSUE"], expected: "Kebutuhan Rumah" },
    { merchant: "INDOMARET", items: ["AIR MINERAL"], expected: "Kebutuhan Rumah" },
    { merchant: "ALFAMART", items: ["ROTI"], expected: "Kebutuhan Rumah" },
    { merchant: "KFC", items: ["PAKET AYAM"], expected: "Makanan" },
    { merchant: "PERTAMINA", items: ["PERTAMAX"], expected: "Transportasi" },
    { merchant: "GUARDIAN", items: ["VITAMIN C"], expected: "Kesehatan" },
    { merchant: "TOKO KOMPUTER", items: ["GADGET ACCESSORY"], expected: "Elektronik" },
    { merchant: "BIOSKOP CINEMA", items: ["MOVIE TICKET"], expected: "Hiburan" },
    { merchant: "KURSUS SCHOOL UNIVERSITY", items: ["BUKU"], expected: "Pendidikan" },
    { merchant: "MERCHANT TIDAK DIKENAL", items: ["BARANG UMUM"], expected: "Lainnya" }
  ] as const;

  for (const item of cases) {
    const result = classifyReceiptCategory({
      merchant: item.merchant,
      items: item.items.map((name) => ({ name }))
    });

    assert.equal(result.name, item.expected, `Expected ${item.expected} for ${item.merchant}`);
    assert.notEqual(result.name, "Semua kategori");
  }
});

test("Semua kategori is never normalized as a transaction category", () => {
  assert.equal(normalizeTransactionCategoryName("Semua kategori"), undefined);
  assert.equal(
    getGeminiCategoryClassification({
      name: "Semua kategori",
      confidence: 0.99,
      reason: "Wrong UI filter option"
    }),
    undefined
  );
});

test("normalizes Gemini category names case-insensitively", () => {
  assert.equal(normalizeTransactionCategoryName("kebutuhan rumah"), "Kebutuhan Rumah");
  assert.equal(normalizeTransactionCategoryName(" MAKANAN "), "Makanan");
});
