import { PageHeader } from "@/components/app/PageHeader";
import { QuickActionButton } from "@/components/ui/QuickActionButton";
import { getAvailableCategories } from "@/features/categories/queries";
import { TransactionFilters } from "@/features/transactions/TransactionFilters";
import { TransactionTable } from "@/features/transactions/TransactionTable";
import { normalizeTransactionFilters, normalizeTransactionPeriod } from "@/features/transactions/period-filter";
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
}>;

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
    search: params.search || undefined
  });
  const filters = normalizeTransactionFilters(
    parsedFilters.success
      ? parsedFilters.data
      : {
        period: "month" as const,
        month: now.getUTCMonth() + 1,
        year: now.getUTCFullYear(),
        categoryId: undefined,
        search: undefined
      },
    now
  );
  const [categories, transactions] = await Promise.all([
    getAvailableCategories(userId),
    getTransactions(userId, filters)
  ]);

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
          selectedPeriod={filters.period}
          selectedSearch={filters.search}
          selectedStartDate={filters.startDate}
          selectedYear={filters.year ?? now.getUTCFullYear()}
        />
        <TransactionTable transactions={transactions} />
      </div>
    </>
  );
}
