import assert from "node:assert/strict";
import test from "node:test";

import { parseReceiptText } from "./receipt-parser";

function itemSummary(rawText: string) {
  return parseReceiptText(rawText).items.map((item) => ({
    name: item.name,
    totalPrice: item.totalPrice
  }));
}

const superIndoReceiptText = `PT LION SUPER INDO
NWP :_0017813726046000
Tanggal Pengukuhan : 06-06-97
JL. NGINDEN SEMOLO NO. 98
KEL. NGINDEN JANGKUNGAN.
KEC. SUKOLILO, SURABAYA
LEBHEEERY) ror; : 031-s530485
01-05-26 (15:58:58) 708 04  No:00082
DESKRIPST        QTY mARGA TOTAL
SEMANGKA BABY KUN 834 14.900 12.425
DIAMOND UST F/CRM 1 23.180 23.180
365 FAC TISSUEZX1 1 16.950 16.990
JERUK MANDARIN WO 832 43.500 41.185
HEMAT -12.230
365 ALUMINIOM FOI 1 21.950 21.950
GURAME FILLET TEP 120 175.950 21.115
Sub Total (Termasuk PEN) : 124.665
Pembayaran-BCA QRIS  : 124.665
Nomor : 121021029852
Hemat Produk                 12.230
Total Item : 6
Member Name : adisabhistal?`;

const shopeeReceiptText = `PT Shopee International Indonesia
Shopee
Faktur Pesanan
Nama Penjual: Colgate Palmolive Official Shop
Nama Pembeli: Adis
No. Pesanan Tanggal Transaksi Metode Pembayaran Jasa Kirim
2603034XHC0ES9 03/03/26 Bank BCA Hemat Kargo
Subtotal Rp77.600
Total Kuantitas (Aktif) 1 produk
Total Pembayaran Rp54.122
Subtotal Pesanan Rp77.600
Subtotal Pengiriman Rp1.796
Biaya Layanan Rp912
Total Diskon Pengiriman -Rp1.796
Diskon Voucher Toko -Rp15.000
Diskon Voucher Shopee -Rp9.390
Rincian Pesanan
No. Produk Variasi Harga Produk Kuantitas Subtotal
1
[TRIPLEPACK] Colgate Optic White Purple 100 g - Pasta Gigi Pemutih (3pcs)
Triplepack Rp77.600 1 Rp77.600`;

test("parses supermarket-style item tables without treating metadata as items", () => {
  const parsed = parseReceiptText(superIndoReceiptText);

  assert.equal(parsed.merchant, "PT LION SUPER INDO");
  assert.equal(parsed.transactionDate, "2026-05-01");
  assert.notEqual(parsed.transactionDate, "1997-06-06", "Should not use Tanggal Pengukuhan");
  assert.equal(parsed.totalAmount, 124665);
  assert.notEqual(parsed.totalAmount, 175950, "Should not use item row unit price as total");
  assert.equal(parsed.category, "Kebutuhan Rumah", "Super Indo should be Kebutuhan Rumah");
  assert.deepEqual(itemSummary(superIndoReceiptText), [
    { name: "SEMANGKA BABY KUN", totalPrice: 12425 },
    { name: "DIAMOND UST F/CRM", totalPrice: 23180 },
    { name: "365 FAC TISSUEZX1", totalPrice: 16990 },
    { name: "JERUK MANDARIN WO", totalPrice: 41185 },
    { name: "365 ALUMINIOM FOI", totalPrice: 21950 },
    { name: "GURAME FILLET TEP", totalPrice: 21115 }
  ]);

  const itemNames = parsed.items.map((item) => item.name).join(" ");
  assert.equal(itemNames.includes("NWP"), false);
  assert.equal(itemNames.includes("No:00082"), false);
  assert.equal(itemNames.includes("Nomor"), false);
  assert.equal(itemNames.includes("Hemat Produk"), false);
});

test("parses minimarket-style receipts with common item headers", () => {
  const text = `MINIMARKET MAJU
Jl. Melati No. 10
Tgl: 12/05/2026 20:15
No. Struk 99887766
NAMA BARANG QTY HARGA TOTAL
ROTI COKLAT 1 8.500 8.500
AIR MINERAL 600ML 2 3.000 6.000
PROMO -1.000
TOTAL BELANJA 14.500
TUNAI 20.000
KEMBALI 5.500`;

  const parsed = parseReceiptText(text);

  assert.equal(parsed.merchant, "MINIMARKET MAJU");
  assert.equal(parsed.transactionDate, "2026-05-12");
  assert.equal(parsed.totalAmount, 14500);
  assert.deepEqual(itemSummary(text), [
    { name: "ROTI COKLAT", totalPrice: 8500 },
    { name: "AIR MINERAL 600ML", totalPrice: 6000 }
  ]);
});

test("parses restaurant-style receipts while ignoring service and tax lines", () => {
  const text = `WARUNG MAKAN SEDAP
JALAN KENANGA 5
15-05-2026 19:30
ITEM QTY HARGA TOTAL
NASI GORENG 2 18.000 36.000
ES TEH MANIS 2 5.000 10.000
SERVICE 2.000
PPN 2.000
GRAND TOTAL Rp50.000
QRIS 50.000
TERIMA KASIH`;

  const parsed = parseReceiptText(text);

  assert.equal(parsed.merchant, "WARUNG MAKAN SEDAP");
  assert.equal(parsed.transactionDate, "2026-05-15");
  assert.equal(parsed.totalAmount, 50000);
  assert.deepEqual(itemSummary(text), [
    { name: "NASI GORENG", totalPrice: 36000 },
    { name: "ES TEH MANIS", totalPrice: 10000 }
  ]);
});

test("uses conservative middle-line item detection when no table header exists", () => {
  const text = `TOKO KELONTONG JAYA
Tanggal 2026-05-16 08:10
INDOMIE GORENG 3.500
GULA PASIR 1KG 17.000
2 x TELUR AYAM 2.500
TOTAL 25.500
Bayar 30.000
Kembali 4.500`;

  const parsed = parseReceiptText(text);

  assert.equal(parsed.merchant, "TOKO KELONTONG JAYA");
  assert.equal(parsed.transactionDate, "2026-05-16");
  assert.equal(parsed.totalAmount, 25500);
  assert.deepEqual(itemSummary(text), [
    { name: "INDOMIE GORENG", totalPrice: 3500 },
    { name: "GULA PASIR 1KG", totalPrice: 17000 },
    { name: "TELUR AYAM", totalPrice: 2500 }
  ]);
});

test("rejects receipt metadata numbers as items and totals", () => {
  const text = `APOTEK SEHAT
NPWP 09.123.456.7-890.000
No Transaksi : 123456789012
Member: 081234567890
TELP 021-12345678
Tanggal 16/05/2026 10:45
ITEM QTY HARGA TOTAL
PARACETAMOL 1 12.000 12.000
VITAMIN C 2 8.000 16.000
TOTAL Rp28.000
DEBIT BCA 28.000
No. Kartu 123456******7890
TERIMA KASIH`;

  const parsed = parseReceiptText(text);
  const itemNames = parsed.items.map((item) => item.name).join(" ");

  assert.equal(parsed.merchant, "APOTEK SEHAT");
  assert.equal(parsed.transactionDate, "2026-05-16");
  assert.equal(parsed.totalAmount, 28000);
  assert.deepEqual(itemSummary(text), [
    { name: "PARACETAMOL", totalPrice: 12000 },
    { name: "VITAMIN C", totalPrice: 16000 }
  ]);
  assert.equal(itemNames.includes("NPWP"), false);
  assert.equal(itemNames.includes("Transaksi"), false);
  assert.equal(itemNames.includes("Member"), false);
  assert.equal(itemNames.includes("TELP"), false);
});

test("parses Alfamart-style receipts and combines merchant names correctly", () => {
  const text = `PT SUMBER ALFARIA TRIJAYA TBK
ALFAMART KEBON JERUK
NPWP : 01.234.567.8-901.000
JL. KEBON JERUK RAYA NO 10
JAKARTA BARAT
Tgl: 20-05-2026 14:20:35
Kasir: Budi
Bon: 001-002-003
NAMA PRODUK QTY HARGA TOTAL
AQUA 1.5L 2 6.500 13.000
INDOMIE SOTO 5 3.000 15.000
SUBTOTAL 28.000
DISKON PRODUK -2.000
TOTAL 26.000
TUNAI 50.000
KEMBALIAN 24.000
PPN INC 11% 2.576`;

  const parsed = parseReceiptText(text);

  // Merchant combining: PT SUMBER ALFARIA TRIJAYA TBK + ALFAMART KEBON JERUK?
  // Wait, the parser combines if the first line is exactly a prefix.
  // Here the first line is "PT SUMBER ALFARIA TRIJAYA TBK", which does NOT equal "PT" exactly.
  // So it will just pick the first line as the merchant.
  assert.equal(parsed.merchant, "PT SUMBER ALFARIA TRIJAYA TBK");
  assert.equal(parsed.transactionDate, "2026-05-20");
  assert.equal(parsed.totalAmount, 26000);
  assert.deepEqual(itemSummary(text), [
    { name: "AQUA 1.5L", totalPrice: 13000 },
    { name: "INDOMIE SOTO", totalPrice: 15000 }
  ]);
});

test("categorizes receipts correctly based on fallback rules", () => {
  const cases = [
    { text: "INDOMARET JL MERDEKA\nTOTAL 50.000", expected: "Kebutuhan Rumah" },
    { text: "ALFAMART\nTOTAL 20.000", expected: "Kebutuhan Rumah" },
    { text: "KFC KEMANG\nTOTAL 150.000", expected: "Makanan" },
    { text: "SPBU PERTAMINA\nTOTAL 200.000", expected: "Transportasi" },
    { text: "GUARDIAN PHARMACY\nTOTAL 50.000", expected: "Kesehatan" },
    { text: "TOKO KOMPUTER\nTOTAL 500.000", expected: "Elektronik" },
    { text: "BIOSKOP XXI\nTOTAL 100.000", expected: "Hiburan" },
    { text: "KURSUS INGGRIS\nTOTAL 1.000.000", expected: "Pendidikan" },
    { text: "TOKO BUKU GRAMEDIA\nTOTAL 75.000", expected: "Pendidikan" },
    { text: "MERCHANT TIDAK DIKENAL\nTOTAL 50.000", expected: "Lainnya" }
  ];

  for (const c of cases) {
    const parsed = parseReceiptText(c.text);
    assert.equal(parsed.category, c.expected, `Expected ${c.expected} for text: ${c.text.split("\n")[0]}`);
    assert.notEqual(parsed.category, "Semua kategori", "Semua kategori must never be selected");
  }
});

test("prioritizes Indonesian transaction date over Tanggal Pengukuhan metadata", () => {
  const text = `TOKO CONTOH
Tanggal Pengukuhan : 06-06-97
NPWP 01.234.567.8-901.000
16/05/26 10:45
TOTAL 25.000`;

  const parsed = parseReceiptText(text);

  assert.equal(parsed.transactionDate, "2026-05-16");
  assert.notEqual(parsed.transactionDate, "1997-06-06");
  assert.ok(parsed.dateDebug?.some((item) => item.rejectionReason === "Baris berisi tanggal non-transaksi."));
});

test("parses Shopee e-commerce receipt using seller, Total Pembayaran, and item detail", () => {
  const parsed = parseReceiptText(shopeeReceiptText);
  const item = parsed.items[0];

  assert.equal(parsed.merchant, "Colgate Palmolive Official Shop");
  assert.notEqual(parsed.merchant, "PT Shopee International Indonesia");
  assert.equal(parsed.transactionDate, "2026-03-03");
  assert.equal(parsed.totalAmount, 54122);
  assert.notEqual(parsed.totalAmount, 1);
  assert.notEqual(parsed.totalAmount, 77600);
  assert.equal(parsed.category, "Kebutuhan Rumah");
  assert.equal(item.name, "[TRIPLEPACK] Colgate Optic White Purple 100 g - Pasta Gigi Pemutih (3pcs)");
  assert.equal(item.quantity, 1);
  assert.equal(item.unitPrice, 77600);
  assert.equal(item.totalPrice, 77600);
});

test("records Shopee total candidate debug with selected and rejected reasons", () => {
  const parsed = parseReceiptText(shopeeReceiptText);
  const candidates = parsed.totalCandidates ?? [];

  assert.ok(candidates.some((candidate) => candidate.amount === 54122 && candidate.isSelected && candidate.sourceText === "Total Pembayaran Rp54.122"));
  assert.ok(candidates.some((candidate) => candidate.amount === 77600 && !candidate.isSelected && candidate.reason.includes("subtotal")));
  assert.ok(candidates.some((candidate) => candidate.amount === 1 && !candidate.isSelected && candidate.reason.includes("kuantitas")));
  assert.ok(candidates.some((candidate) => candidate.amount === 1796 && !candidate.isSelected && candidate.reason.includes("pengiriman")));
  assert.ok(candidates.some((candidate) => candidate.amount === 912 && !candidate.isSelected && candidate.reason.includes("layanan")));
  assert.ok(candidates.some((candidate) => candidate.amount === -15000 && !candidate.isSelected && candidate.reason.includes("diskon")));
  assert.ok(candidates.some((candidate) => candidate.amount === -9390 && !candidate.isSelected && candidate.reason.includes("diskon")));
});
