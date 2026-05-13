import Link from "next/link";

import { PageHeader } from "@/components/app/PageHeader";
import { getAvailableCategories } from "@/features/categories/queries";
import { TransactionFilters } from "@/features/transactions/TransactionFilters";
import { TransactionTable } from "@/features/transactions/TransactionTable";
import { getTransactions } from "@/features/transactions/queries";
import { requireUserId } from "@/lib/auth";
import { NEW_TRANSACTION_ROUTE, SCAN_RECEIPT_ROUTE } from "@/lib/routes";
import { transactionFilterSchema } from "@/lib/validation/transaction";

export default async function TransactionsPage({
  searchParams
}: {
  searchParams: { period?: string; month?: string; year?: string; startDate?: string; endDate?: string; categoryId?: string };
}) {
  const userId = await requireUserId();
  const now = new Date();
  const parsedFilters = transactionFilterSchema.safeParse({
    period: searchParams.period || undefined,
    month: searchParams.month || now.getUTCMonth() + 1,
    year: searchParams.year || now.getUTCFullYear(),
    startDate: searchParams.startDate || undefined,
    endDate: searchParams.endDate || undefined,
    categoryId: searchParams.categoryId || undefined
  });
  const filters = parsedFilters.success
    ? parsedFilters.data
    : {
        period: "month" as const,
        month: now.getUTCMonth() + 1,
        year: now.getUTCFullYear(),
        categoryId: undefined
      };
  const [categories, transactions] = await Promise.all([
    getAvailableCategories(userId),
    getTransactions(userId, filters)
  ]);

  return (
    <>
      <PageHeader
        title="Transaksi"
        description="Lihat, filter, ubah, hapus, dan ekspor transaksi."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700" href={NEW_TRANSACTION_ROUTE}>
              Tambah Transaksi Manual
            </Link>
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" href={SCAN_RECEIPT_ROUTE}>
              Pindai Struk
            </Link>
          </div>
        }
      />
      <TransactionFilters
        categories={categories}
        selectedCategoryId={filters.categoryId}
        selectedEndDate={filters.endDate}
        selectedMonth={filters.month ?? now.getUTCMonth() + 1}
        selectedPeriod={filters.period}
        selectedStartDate={filters.startDate}
        selectedYear={filters.year ?? now.getUTCFullYear()}
      />
      <TransactionTable transactions={transactions} />
    </>
  );
}
