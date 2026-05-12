import Link from "next/link";

import { PageHeader } from "@/components/app/PageHeader";
import { Card } from "@/components/ui/Card";
import { BudgetProgressList } from "@/features/dashboard/BudgetProgressList";
import { CategoryChart } from "@/features/dashboard/CategoryChart";
import { RecentTransactions } from "@/features/dashboard/RecentTransactions";
import { getBudgets } from "@/features/budgets/queries";
import { getMonthRange, getTransactions } from "@/features/transactions/queries";
import { requireUserId } from "@/lib/auth";
import { formatCurrency } from "@/lib/format/currency";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const userId = await requireUserId();
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  const { start, end } = getMonthRange(year, month);

  const [monthlyTransactions, recentTransactions, monthlyBudgets] = await Promise.all([
    getTransactions(userId, { month, year }),
    prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { transactionDate: "desc" },
      take: 5
    }),
    getBudgets(userId, year, month)
  ]);

  const totalExpenses = monthlyTransactions.reduce((sum, transaction) => sum + Number(transaction.totalAmount), 0);
  const categoryTotals = monthlyTransactions.reduce<Record<string, number>>((totals, transaction) => {
    totals[transaction.category.name] = (totals[transaction.category.name] ?? 0) + Number(transaction.totalAmount);
    return totals;
  }, {});
  const chartData = Object.entries(categoryTotals).map(([name, total]) => ({ name, total }));
  const highestCategory = chartData.sort((a, b) => b.total - a.total)[0];
  const budgetItems = monthlyBudgets.map((budget) => ({
    categoryName: budget.category.name,
    budgetAmount: Number(budget.amount),
    usedAmount: monthlyTransactions
      .filter((transaction) => transaction.categoryId === budget.categoryId)
      .reduce((sum, transaction) => sum + Number(transaction.totalAmount), 0)
  }));

  return (
    <>
      <PageHeader
        title="Dasbor"
        description="Ringkasan pengeluaran, kategori, dan anggaran bulan ini."
        action={
          <Link className="inline-flex rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700" href="/scan">
            Pindai Struk Baru
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm font-medium text-slate-500">Pengeluaran Bulan Ini</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{formatCurrency(totalExpenses)}</p>
          <p className="mt-2 text-xs text-slate-500">
            {start.toLocaleDateString("id-ID")} - {new Date(end.getTime() - 1).toLocaleDateString("id-ID")}
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-slate-500">Kategori Terbesar</p>
          <p className="mt-3 text-2xl font-bold text-slate-950">{highestCategory?.name ?? "Belum ada"}</p>
          <p className="mt-2 text-sm text-slate-500">{highestCategory ? formatCurrency(highestCategory.total) : "Belum ada transaksi"}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-slate-500">Jumlah Transaksi</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{monthlyTransactions.length}</p>
          <p className="mt-2 text-sm text-slate-500">Transaksi bulan ini</p>
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
          <h2 className="text-base font-semibold text-slate-950">Progress Anggaran</h2>
          <div className="mt-4">
            <BudgetProgressList items={budgetItems} />
          </div>
        </Card>
      </div>

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
