import { TRANSACTIONS_ROUTE } from "@/lib/routes";

export const TRANSACTION_SAVE_ERROR_MESSAGE = "Gagal menyimpan transaksi. Silakan coba lagi.";

export function getTransactionSaveSuccessPath() {
  return TRANSACTIONS_ROUTE;
}

export function getTransactionSaveErrorPath(formPath: string) {
  return `${formPath}?error=${encodeURIComponent(TRANSACTION_SAVE_ERROR_MESSAGE)}`;
}
