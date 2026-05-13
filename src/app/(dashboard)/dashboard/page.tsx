import Link from "next/link";

import { PageHeader } from "@/components/app/PageHeader";
import { Card } from "@/components/ui/Card";
import { BudgetProgressList } from "@/features/dashboard/BudgetProgressList";
import { CategoryChart } from "@/features/dashboard/CategoryChart";
import { DashboardPeriodFilter } from "@/features/dashboard/DashboardPeriodFilter";
import { MonthlyBreakdownChart } from "@/features/dashboard/MonthlyBreakdownChart";
import { RecentTransactions } from "@/features/dashboard/RecentTransactions";
import { getBudgets } from "@/features/budgets/queries";
import { getFilterLabel, getMonthRange, getTransactions, getYearRange } from "@/features/transactions/queries";
import { requireUserId } from "@/lib/auth";
import { formatCurrency } from "@/lib/format/currency";
import { NEW_TRANSACTION_ROUTE, SCAN_RECEIPT_ROUTE } from "@/lib/routes";
import { transactionFilterSchema } from "@/lib/validation/transaction";

const monthShortLabels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

type DashboardPageSearchParams = Promise<{
  period?: string;
  month?: string;
  year?: string;
  startDate?: string;
  endDate?: string;
}>;

export default async function DashboardPage({
  searchParams
}: {
  searchParams: DashboardPageSearchParams;
}) {
  const params = await searchParams;
  const userId = await requireUserId();
  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();
  const parsedFilters = transactionFilterSchema.safeParse({
    period: params.period || undefined,
    month: params.month || currentMonth,
    year: params.year || currentYear,
    startDate: params.startDate || undefined,
    endDate: params.endDate || undefined
  });
  const filters = parsedFilters.success
    ? parsedFilters.data
    : {
        period: "month" as const,
        month: currentMonth,
        year: currentYear,
        startDate: undefined,
        endDate: undefined
      };
  const budgetMonth = filters.period === "month" ? filters.month ?? currentMonth : currentMonth;
  const budgetYear = filters.period === "month" ? filters.year ?? currentYear : currentYear;
  const { start, end } = getMonthRange(budgetYear, budgetMonth);

  const [filteredTransactions, monthlyBudgets, budgetMonthTransactions] = await Promise.all([
    getTransactions(userId, filters),
    getBudgets(userId, budgetYear, budgetMonth),
    getTransactions(userId, { period: "month", year: budgetYear, month: budgetMonth })
  ]);

  const totalExpenses = filteredTransactions.reduce((sum, transaction) => sum + Number(transaction.totalAmount), 0);
  const categoryTotals = filteredTransactions.reduce<Record<string, number>>((totals, transaction) => {
    totals[transaction.category.name] = (totals[transaction.category.name] ?? 0) + Number(transaction.totalAmount);
    return totals;
  }, {});
  const chartData = Object.entries(categoryTotals).map(([name, total]) => ({ name, total }));
  const highestCategory = chartData.sort((a, b) => b.total - a.total)[0];
  const budgetItems = monthlyBudgets.map((budget) => ({
    categoryName: budget.category.name,
    budgetAmount: Number(budget.amount),
    usedAmount: budgetMonthTransactions
      .filter((transaction) => transaction.categoryId === budget.categoryId)
      .reduce((sum, transaction) => sum + Number(transaction.totalAmount), 0)
  }));
  const recentTransactions = filteredTransactions.slice(0, 5);
  const selectedYear = filters.year ?? currentYear;
  const yearlyBreakdown =
    filters.period === "year"
      ? monthShortLabels.map((name, index) => {
          const monthRange = getMonthRange(selectedYear, index + 1);
          const total = filteredTransactions
            .filter((transaction) => transaction.transactionDate >= monthRange.start && transaction.transactionDate < monthRange.end)
            .reduce((sum, transaction) => sum + Number(transaction.totalAmount), 0);

          return { name, total };
        })
      : [];
  const periodLabel = getFilterLabel(filters, now);
  const selectedDateRange = filters.period === "year" ? getYearRange(selectedYear) : filters.period === "month" ? getMonthRange(filters.year ?? currentYear, filters.month ?? currentMonth) : null;

  return (
    <>
      <PageHeader
        title="Dasbor"
        description="Ringkasan pengeluaran, kategori, dan anggaran."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700" href={SCAN_RECEIPT_ROUTE}>
              Pindai Struk Baru
            </Link>
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" href={NEW_TRANSACTION_ROUTE}>
              Tambah Manual
            </Link>
          </div>
        }
      />

      <DashboardPeriodFilter
        selectedEndDate={filters.endDate}
        selectedMonth={filters.month ?? currentMonth}
        selectedPeriod={filters.period}
        selectedStartDate={filters.startDate}
        selectedYear={filters.year ?? currentYear}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm font-medium text-slate-500">Total Pengeluaran</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{formatCurrency(totalExpenses)}</p>
          <p className="mt-2 text-xs text-slate-500">
            {selectedDateRange
              ? `${selectedDateRange.start.toLocaleDateString("id-ID")} - ${new Date(selectedDateRange.end.getTime() - 1).toLocaleDateString("id-ID")}`
              : periodLabel}
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-slate-500">Kategori Terbesar</p>
          <p className="mt-3 text-2xl font-bold text-slate-950">{highestCategory?.name ?? "Belum ada"}</p>
          <p className="mt-2 text-sm text-slate-500">{highestCategory ? formatCurrency(highestCategory.total) : "Belum ada transaksi"}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-slate-500">Jumlah Transaksi</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{filteredTransactions.length}</p>
          <p className="mt-2 text-sm text-slate-500">Transaksi pada periode ini</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <h2 className="text-base font-semibold text-slate-950">Pengeluaran per Kategori</h2>
          <div className="mt-4">
            <CategoryChart data={chartData} />
          </div>
        </Card>
        <Card>
          <h2 className="text-base font-semibold text-slate-950">Progres Anggaran Bulanan</h2>
          <p className="mt-1 text-sm text-slate-500">
            {start.toLocaleDateString("id-ID")} - {new Date(end.getTime() - 1).toLocaleDateString("id-ID")}
          </p>
          <div className="mt-4">
            <BudgetProgressList items={budgetItems} />
          </div>
        </Card>
      </div>

      {filters.period === "year" ? (
        <Card>
          <h2 className="text-base font-semibold text-slate-950">Rincian Bulanan</h2>
          <div className="mt-4">
            <MonthlyBreakdownChart data={yearlyBreakdown} />
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-950">Transaksi Terbaru</h2>
          <Link className="text-sm font-semibold text-brand-700" href="/transactions">
            Lihat semua
          </Link>
        </div>
        <RecentTransactions transactions={recentTransactions} />
      </Card>
    </>
  );
}
