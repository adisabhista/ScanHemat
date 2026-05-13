import type { Transaction, Category } from "@prisma/client";

import { formatDate } from "@/lib/format/date";

type ExportTransaction = Transaction & {
  category: Category;
};

function escapeCsvCell(value: string) {
  const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;

  return `"${safeValue.replaceAll('"', '""')}"`;
}

export function buildTransactionsCsv(transactions: ExportTransaction[]) {
  const headers = ["tanggal", "toko", "kategori", "total", "catatan"];
  const rows = transactions.map((transaction) => [
    formatDate(transaction.transactionDate),
    transaction.merchant ?? "",
    transaction.category.name,
    transaction.totalAmount.toString(),
    transaction.notes ?? ""
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}
