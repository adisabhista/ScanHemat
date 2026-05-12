import { PageHeader } from "@/components/app/PageHeader";
import { getAvailableCategories } from "@/features/categories/queries";
import { TransactionFilters } from "@/features/transactions/TransactionFilters";
import { TransactionTable } from "@/features/transactions/TransactionTable";
import { getTransactions } from "@/features/transactions/queries";
import { requireUserId } from "@/lib/auth";

export default async function TransactionsPage({
  searchParams
}: {
  searchParams: { month?: string; year?: string; categoryId?: string };
}) {
  const userId = await requireUserId();
  const now = new Date();
  const month = Number(searchParams.month ?? now.getUTCMonth() + 1);
  const year = Number(searchParams.year ?? now.getUTCFullYear());
  const categoryId = searchParams.categoryId || undefined;
  const [categories, transactions] = await Promise.all([
    getAvailableCategories(userId),
    getTransactions(userId, { month, year, categoryId })
  ]);

  return (
    <>
      <PageHeader title="Transaksi" description="Lihat, filter, ubah, hapus, dan ekspor transaksi." />
      <TransactionFilters
        categories={categories}
        selectedCategoryId={categoryId}
        selectedMonth={month}
        selectedYear={year}
      />
      <TransactionTable transactions={transactions} />
    </>
  );
}
