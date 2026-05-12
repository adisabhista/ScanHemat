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

test("parses supermarket-style item tables without treating metadata as items", () => {
  const parsed = parseReceiptText(superIndoReceiptText);

  assert.equal(parsed.merchant, "PT LION SUPER INDO");
  assert.equal(parsed.transactionDate, "2026-05-01");
  assert.equal(parsed.totalAmount, 124665);
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
