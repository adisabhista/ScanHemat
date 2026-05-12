import type { Category, Transaction } from "@prisma/client";
import Link from "next/link";

import { formatCurrency } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";

type RecentTransaction = Transaction & {
  category: Category;
};

export function RecentTransactions({ transactions }: { transactions: RecentTransaction[] }) {
  if (transactions.length === 0) {
    return <p className="text-sm text-slate-500">Belum ada transaksi</p>;
  }

  return (
    <div className="divide-y divide-slate-100">
      {transactions.map((transaction) => (
        <Link className="flex items-center justify-between gap-4 py-3" href={`/transactions/${transaction.id}`} key={transaction.id}>
          <div>
            <p className="font-medium text-slate-950">{transaction.merchant || "Tanpa merchant"}</p>
            <p className="text-sm text-slate-500">
              {formatDate(transaction.transactionDate)} - {transaction.category.name}
            </p>
          </div>
          <p className="font-semibold text-slate-950">{formatCurrency(transaction.totalAmount.toString())}</p>
        </Link>
      ))}
    </div>
  );
}
