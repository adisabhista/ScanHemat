import { PageHeader } from "@/components/app/PageHeader";
import { QuickActionButton } from "@/components/ui/QuickActionButton";
import { getAvailableCategories } from "@/features/categories/queries";
import { TransactionFilters } from "@/features/transactions/TransactionFilters";
import { TransactionTable } from "@/features/transactions/TransactionTable";
import { buildTransactionFilterSearchParams, normalizeTransactionFilters, normalizeTransactionPeriod } from "@/features/transactions/period-filter";
import { getTransactions } from "@/features/transactions/queries";
import { requireUserId } from "@/lib/auth";
import { NEW_TRANSACTION_ROUTE, SCAN_RECEIPT_ROUTE } from "@/lib/routes";
import { transactionFilterSchema } from "@/lib/validation/transaction";

type TransactionsPageSearchParams = Promise<{
  period?: string;
  month?: string;
  year?: string;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  search?: string;
  needsReview?: string;
  take?: string;
}>;

const transactionPageSize = 50;

export default async function TransactionsPage({
  searchParams
}: {
  searchParams: TransactionsPageSearchParams;
}) {
  const params = await searchParams;
  const userId = await requireUserId();
  const now = new Date();
  const requestedPeriod = normalizeTransactionPeriod(params.period);
  const parsedFilters = transactionFilterSchema.safeParse({
    period: requestedPeriod,
    month: requestedPeriod === "month" ? params.month || now.getUTCMonth() + 1 : undefined,
    year: requestedPeriod === "month" || requestedPeriod === "year" ? params.year || now.getUTCFullYear() : undefined,
    startDate: requestedPeriod === "custom" ? params.startDate || undefined : undefined,
    endDate: requestedPeriod === "custom" ? params.endDate || undefined : undefined,
    categoryId: params.categoryId || undefined,
    search: params.search || undefined,
    needsReview: params.needsReview || undefined
  });
  const filters = normalizeTransactionFilters(
    parsedFilters.success
      ? parsedFilters.data
      : {
        period: "month" as const,
        month: now.getUTCMonth() + 1,
        year: now.getUTCFullYear(),
        categoryId: undefined,
        search: undefined,
        needsReview: undefined
      },
    now
  );
  const requestedTake = Number(params.take);
  const take = Number.isInteger(requestedTake) && requestedTake > transactionPageSize ? requestedTake : transactionPageSize;
  const [categories, transactionPage] = await Promise.all([
    getAvailableCategories(userId),
    getTransactions(userId, filters, { take })
  ]);
  const nextParams = buildTransactionFilterSearchParams(filters, now);

  if (transactionPage.hasMore) {
    nextParams.set("take", String(take + transactionPageSize));
  }

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Transaksi"
          description="Cari, filter, koreksi, dan ekspor transaksi dengan tampilan yang mudah dipindai."
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <QuickActionButton href={NEW_TRANSACTION_ROUTE}>Tambah Transaksi Manual</QuickActionButton>
              <QuickActionButton href={SCAN_RECEIPT_ROUTE} variant="secondary">
                Pindai Struk
              </QuickActionButton>
            </div>
          }
        />
        <TransactionFilters
          categories={categories}
          selectedCategoryId={filters.categoryId}
          selectedEndDate={filters.endDate}
          selectedMonth={filters.month ?? now.getUTCMonth() + 1}
          selectedNeedsReview={Boolean(filters.needsReview)}
          selectedPeriod={filters.period}
          selectedSearch={filters.search}
          selectedStartDate={filters.startDate}
          selectedYear={filters.year ?? now.getUTCFullYear()}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {typeof transactionPage.totalCount === "number"
              ? `Menampilkan ${transactionPage.data.length} dari ${transactionPage.totalCount} transaksi`
              : `Menampilkan ${transactionPage.data.length} transaksi`}
          </p>
          {transactionPage.hasMore && transactionPage.nextCursor ? (
            <a
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-700 dark:bg-slate-900 dark:text-brand-100 dark:hover:bg-brand-500/10 dark:focus:ring-offset-slate-950"
              href={`/transactions?${nextParams.toString()}`}
            >
              Muat lagi
            </a>
          ) : null}
        </div>
        <TransactionTable transactions={transactionPage.data} />
      </div>
    </>
  );
}
