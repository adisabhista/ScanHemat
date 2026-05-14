import assert from "node:assert/strict";
import test from "node:test";

import { generateReceiptAudit } from "@/lib/audit/receipt-audit";
import { parseReceiptText } from "@/lib/parser/receipt-parser";

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

const superIndoReceiptText = `PT LION SUPER INDO
NWP :_0017813726046000
Tanggal Pengukuhan : 06-06-97
JL. NGINDEN SEMOLO NO. 98
01-05-26 (15:58:58) 708 04  No:00082
DESKRIPST        QTY mARGA TOTAL
SEMANGKA BABY KUN 834 14.900 12.425
GURAME FILLET TEP 120 175.950 21.115
Sub Total (Termasuk PPN) : 124.665
Pembayaran-BCA QRIS  : 124.665
Hemat Produk                 12.230
Total Item : 6`;

test("builds Shopee audit with selected Total Pembayaran and rejected non-final totals", () => {
  const parsed = parseReceiptText(shopeeReceiptText);
  const audit = generateReceiptAudit({ rawText: shopeeReceiptText, parsedReceipt: parsed });

  assert.equal(parsed.totalAmount, 54122);
  assert.equal(audit.selectedFields.totalAmount?.value, 54122);
  assert.ok(audit.selectedFields.totalAmount?.sourceText?.includes("Total Pembayaran Rp54.122"));
  assert.ok(audit.rejectedCandidates.some((candidate) => candidate.value === 1 && candidate.sourceText.includes("Total Kuantitas")));
  assert.ok(audit.rejectedCandidates.some((candidate) => candidate.value === 77600 && /Subtotal|Produk|Triplepack/.test(candidate.sourceText)));
  assert.ok(audit.rejectedCandidates.some((candidate) => candidate.sourceText.includes("Subtotal Pengiriman")));
  assert.ok(audit.rejectedCandidates.some((candidate) => candidate.sourceText.includes("Biaya Layanan")));
  assert.ok(audit.rejectedCandidates.some((candidate) => candidate.sourceText.includes("Diskon Voucher Toko")));
  assert.ok(audit.rejectedCandidates.some((candidate) => candidate.sourceText.includes("Diskon Voucher Shopee")));
  assert.ok(audit.selectedFields.merchant?.sourceText?.includes("Nama Penjual"));
  assert.notEqual(audit.confidence, "low");
});

test("builds Super Indo audit with payment and subtotal match", () => {
  const parsed = parseReceiptText(superIndoReceiptText);
  const audit = generateReceiptAudit({ rawText: superIndoReceiptText, parsedReceipt: parsed });

  assert.equal(parsed.totalAmount, 124665);
  assert.equal(audit.selectedFields.totalAmount?.value, 124665);
  assert.ok(audit.acceptedCandidates.some((candidate) => candidate.sourceText.includes("Pembayaran-BCA QRIS")));
  assert.ok(audit.acceptedCandidates.some((candidate) => candidate.sourceText.includes("Sub Total")));
  assert.ok(audit.summary.includes("cocok dengan subtotal"));
  assert.ok(audit.rejectedCandidates.some((candidate) => candidate.value === 175950 && candidate.reason.includes("harga satuan")));
  assert.equal(audit.confidence, "high");
});

test("builds date audit that rejects Tanggal Pengukuhan", () => {
  const parsed = parseReceiptText(superIndoReceiptText);
  const audit = generateReceiptAudit({ rawText: superIndoReceiptText, parsedReceipt: parsed });

  assert.equal(parsed.transactionDate, "2026-05-01");
  assert.ok(audit.selectedFields.transactionDate?.sourceText?.includes("01-05-26"));
  assert.ok(audit.rejectedCandidates.some((candidate) => candidate.sourceText.includes("06-06-97")));
});

test("builds category audit for known and unknown merchants", () => {
  const superIndo = parseReceiptText(superIndoReceiptText);
  const superIndoAudit = generateReceiptAudit({ rawText: superIndoReceiptText, parsedReceipt: superIndo });
  const shopee = parseReceiptText(shopeeReceiptText);
  const shopeeAudit = generateReceiptAudit({ rawText: shopeeReceiptText, parsedReceipt: shopee });
  const unknownText = `MERCHANT TIDAK DIKENAL
16/05/26
TOTAL 50.000`;
  const unknown = parseReceiptText(unknownText);
  const unknownAudit = generateReceiptAudit({ rawText: unknownText, parsedReceipt: unknown });

  assert.equal(superIndoAudit.selectedFields.category?.value, "Kebutuhan Rumah");
  assert.equal(shopeeAudit.selectedFields.category?.value, "Kebutuhan Rumah");
  assert.equal(unknownAudit.selectedFields.category?.value, "Lainnya");
  assert.ok((unknownAudit.selectedFields.category?.confidence ?? 1) < 0.6);
});
