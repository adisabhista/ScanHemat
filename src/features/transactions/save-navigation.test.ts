import assert from "node:assert/strict";
import test from "node:test";

import {
  getTransactionSaveErrorPath,
  getTransactionSaveSuccessPath,
  TRANSACTION_SAVE_ERROR_MESSAGE
} from "@/features/transactions/save-navigation";

test("successful transaction save returns to the transaction list", () => {
  assert.equal(getTransactionSaveSuccessPath(), "/transactions");
});

test("failed edit save stays on the edit page with a safe Indonesian error", () => {
  const path = getTransactionSaveErrorPath("/transactions/transaction-1");

  assert.equal(path, `/transactions/transaction-1?error=${encodeURIComponent(TRANSACTION_SAVE_ERROR_MESSAGE)}`);
  assert.match(decodeURIComponent(path), /Gagal menyimpan transaksi\. Silakan coba lagi\./);
});
