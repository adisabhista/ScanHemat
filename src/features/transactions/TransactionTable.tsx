import type { Category, Receipt, Transaction, TransactionItem } from "@prisma/client";
import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";

type TransactionWithRelations = Transaction & {
  category: Category;
  receipt: Receipt | null;
  items: TransactionItem[];
};

export function TransactionTable({ transactions }: { transactions: TransactionWithRelations[] }) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        title="Belum ada transaksi"
        description="Unggah struk pertama Anda untuk mulai mencatat pengeluaran"
        action={
          <Link className="inline-flex rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700" href="/scan">
            Pindai Struk Baru
          </Link>
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-normal text-slate-500">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(transaction.transactionDate)}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{transaction.merchant || "Tanpa merchant"}</td>
                <td className="px-4 py-3 text-slate-600">{transaction.category.name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">
                  {formatCurrency(transaction.totalAmount.toString())}
                </td>
                <td className="px-4 py-3">
                  <Link className="font-semibold text-brand-700 hover:text-brand-800" href={`/transactions/${transaction.id}`}>
                    Ubah
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
