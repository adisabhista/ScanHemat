import type { Category, Receipt, Transaction, TransactionItem } from "@prisma/client";
import Link from "next/link";

import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { QuickActionButton } from "@/components/ui/QuickActionButton";
import { TransactionSourceBadge } from "@/features/transactions/TransactionSourceBadge";
import { formatCurrency } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";
import { NEW_TRANSACTION_ROUTE, SCAN_RECEIPT_ROUTE } from "@/lib/routes";

type TransactionWithRelations = Transaction & {
  category: Category;
  receipt: Receipt | null;
  items: TransactionItem[];
};

export function TransactionTable({ transactions }: { transactions: TransactionWithRelations[] }) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        title="Belum ada transaksi pada periode ini."
        description="Coba ubah filter, pindai struk baru, atau tambah transaksi manual."
        action={
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <QuickActionButton href={SCAN_RECEIPT_ROUTE}>Pindai Struk</QuickActionButton>
            <QuickActionButton href={NEW_TRANSACTION_ROUTE} variant="secondary">
              Tambah Manual
            </QuickActionButton>
          </div>
        }
      />
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-normal text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Toko</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Sumber</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {transactions.map((transaction) => (
                <tr className="transition hover:bg-slate-50 dark:hover:bg-slate-800/70" key={transaction.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(transaction.transactionDate)}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{transaction.merchant || "Tanpa toko"}</p>
                    {transaction.notes ? <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{transaction.notes}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <CategoryBadge color={transaction.category.color} name={transaction.category.name} />
                  </td>
                  <td className="px-4 py-3">
                    <TransactionSourceBadge source={transaction.source} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(transaction.totalAmount.toString())}
                  </td>
                  <td className="px-4 py-3">
                    <Link className="inline-flex min-h-9 items-center rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-700 dark:text-brand-100 dark:hover:bg-brand-500/10 dark:focus:ring-offset-slate-950" href={`/transactions/${transaction.id}`}>
                      Ubah
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid gap-3 md:hidden">
        {transactions.map((transaction) => (
          <Link
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-brand-500/10"
            href={`/transactions/${transaction.id}`}
            key={transaction.id}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-950">{transaction.merchant || "Tanpa toko"}</p>
                <p className="mt-1 text-sm text-slate-500">{formatDate(transaction.transactionDate)}</p>
              </div>
              <p className="whitespace-nowrap text-right font-bold text-slate-950">{formatCurrency(transaction.totalAmount.toString())}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <CategoryBadge color={transaction.category.color} name={transaction.category.name} />
              <TransactionSourceBadge source={transaction.source} />
            </div>
            {transaction.notes ? <p className="mt-3 line-clamp-2 text-sm text-slate-500">{transaction.notes}</p> : null}
          </Link>
        ))}
      </div>
    </>
  );
}
