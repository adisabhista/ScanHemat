import Link from "next/link";

import { PageHeader } from "@/components/app/PageHeader";
import { Card } from "@/components/ui/Card";
import { DataCard } from "@/components/ui/DataCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { QuickActionButton } from "@/components/ui/QuickActionButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { BudgetProgressList } from "@/features/dashboard/BudgetProgressList";
import { CategoryChart } from "@/features/dashboard/CategoryChart";
import { DashboardPeriodFilter } from "@/features/dashboard/DashboardPeriodFilter";
import { MonthlyBreakdownChart } from "@/features/dashboard/MonthlyBreakdownChart";
import { RecentTransactions } from "@/features/dashboard/RecentTransactions";
import { getDashboardInsight } from "@/features/dashboard/insights";
import { getBudgets } from "@/features/budgets/queries";
import { getReminderNotifications, getUpcomingRemindersForDashboard } from "@/features/reminders/queries";
import { UpcomingRemindersWidget } from "@/features/reminders/UpcomingRemindersWidget";
import { normalizeTransactionFilters, normalizeTransactionPeriod } from "@/features/transactions/period-filter";
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
  const requestedPeriod = normalizeTransactionPeriod(params.period);
  const parsedFilters = transactionFilterSchema.safeParse({
    period: requestedPeriod,
    month: requestedPeriod === "month" ? params.month || currentMonth : undefined,
    year: requestedPeriod === "month" || requestedPeriod === "year" ? params.year || currentYear : undefined,
    startDate: requestedPeriod === "custom" ? params.startDate || undefined : undefined,
    endDate: requestedPeriod === "custom" ? params.endDate || undefined : undefined
  });
  const filters = normalizeTransactionFilters(
    parsedFilters.success
      ? parsedFilters.data
      : {
        period: "month" as const,
        month: currentMonth,
        year: currentYear,
        startDate: undefined,
        endDate: undefined
      },
    now
  );
  const budgetMonth = filters.period === "month" ? filters.month ?? currentMonth : currentMonth;
  const budgetYear = filters.period === "month" ? filters.year ?? currentYear : currentYear;
  const { start, end } = getMonthRange(budgetYear, budgetMonth);

  const [filteredTransactions, monthlyBudgets, budgetMonthTransactions, upcomingReminders, reminderNotifications] = await Promise.all([
    getTransactions(userId, filters),
    getBudgets(userId, budgetYear, budgetMonth),
    getTransactions(userId, { period: "month", year: budgetYear, month: budgetMonth }),
    getUpcomingRemindersForDashboard(userId, now, 3),
    getReminderNotifications(userId, now)
  ]);

  const totalExpenses = filteredTransactions.reduce((sum, transaction) => sum + Number(transaction.totalAmount), 0);
  const categoryTotals = filteredTransactions.reduce<Record<string, { id: string; name: string; total: number }>>((totals, transaction) => {
    const current = totals[transaction.categoryId] ?? {
      id: transaction.categoryId,
      name: transaction.category.name,
      total: 0
    };
    totals[transaction.categoryId] = {
      ...current,
      total: current.total + Number(transaction.totalAmount)
    };
    return totals;
  }, {});
  const chartData = Object.values(categoryTotals);
  const highestCategory = [...chartData].sort((a, b) => b.total - a.total)[0];
  const dashboardInsight = getDashboardInsight(chartData, totalExpenses);
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
        description="Pantau pola pengeluaran, prioritas kategori, anggaran, dan pengingat penting dalam satu tempat."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <QuickActionButton href={SCAN_RECEIPT_ROUTE} icon={<ReceiptIcon />}>
              Pindai Struk Baru
            </QuickActionButton>
            <QuickActionButton href={NEW_TRANSACTION_ROUTE} icon={<PlusIcon />} variant="secondary">
              Tambah Manual
            </QuickActionButton>
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

      <Card className={`border-l-4 ${dashboardInsight.tone === "warning" ? "border-l-amber-400" : dashboardInsight.tone === "success" ? "border-l-brand-500" : "border-l-sky-400"}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <StatusBadge tone={dashboardInsight.tone === "warning" ? "amber" : dashboardInsight.tone === "success" ? "emerald" : "sky"}>
                {dashboardInsight.title}
              </StatusBadge>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{dashboardInsight.message}</p>
          </div>
          {dashboardInsight.actionHref && dashboardInsight.actionLabel ? (
            <QuickActionButton href={dashboardInsight.actionHref} variant="secondary">
              {dashboardInsight.actionLabel}
            </QuickActionButton>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={<WalletIcon />}
          title="Total Pengeluaran"
          value={formatCurrency(totalExpenses)}
          subtitle={
            selectedDateRange
              ? `${selectedDateRange.start.toLocaleDateString("id-ID")} - ${new Date(selectedDateRange.end.getTime() - 1).toLocaleDateString("id-ID")}`
              : periodLabel
          }
        />
        <MetricCard
          icon={<TagIcon />}
          title="Kategori Terbesar"
          value={highestCategory?.name ?? "Belum ada"}
          subtitle={highestCategory ? formatCurrency(highestCategory.total) : "Belum ada transaksi"}
          tone={highestCategory?.name === "Lainnya" ? "amber" : "brand"}
        />
        <MetricCard
          icon={<ReceiptStackIcon />}
          title="Jumlah Transaksi"
          value={filteredTransactions.length}
          subtitle="Transaksi pada periode ini"
          tone="sky"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <DataCard title="Pengeluaran per Kategori" description="Lihat kategori yang paling banyak menyerap pengeluaran pada periode terpilih.">
          <CategoryChart data={chartData} />
        </DataCard>
        <DataCard
          title="Progres Anggaran Bulanan"
          description={`${start.toLocaleDateString("id-ID")} - ${new Date(end.getTime() - 1).toLocaleDateString("id-ID")}`}
        >
          <BudgetProgressList items={budgetItems} />
        </DataCard>
      </div>

      <UpcomingRemindersWidget notifications={reminderNotifications} reminders={upcomingReminders} />

      {filters.period === "year" ? (
        <DataCard title="Rincian Bulanan" description="Bandingkan ritme pengeluaran sepanjang tahun terpilih.">
          <MonthlyBreakdownChart data={yearlyBreakdown} />
        </DataCard>
      ) : null}

      <DataCard
        title="Transaksi Terbaru"
        description="Aktivitas terakhir pada periode ini."
        action={
          <Link className="text-sm font-semibold text-brand-700" href="/transactions">
            Lihat semua
          </Link>
        }
      >
        <RecentTransactions transactions={recentTransactions} />
      </DataCard>
    </>
  );
}

function WalletIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M19 7V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1" />
      <path d="M16 12h.01" />
      <path d="M17 9h4v6h-4a3 3 0 0 1 0-6Z" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M20.5 13.5 13.5 20.5a2.1 2.1 0 0 1-3 0L3 13V3h10l7.5 7.5a2.1 2.1 0 0 1 0 3Z" />
      <path d="M7.5 7.5h.01" />
    </svg>
  );
}

function ReceiptStackIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M7 3h10l2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5l2-2Z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M7 3h10l2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5l2-2Z" />
      <path d="M9 10h6" />
      <path d="M9 14h4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
