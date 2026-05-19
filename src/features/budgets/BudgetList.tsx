import type { Budget, Category } from "@prisma/client";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { deleteBudgetAction } from "@/features/budgets/actions";
import { formatCurrency } from "@/lib/format/currency";
import { TRANSACTIONS_ROUTE } from "@/lib/routes";

type BudgetWithCategory = Budget & {
  category: Category;
};

export function BudgetList({ budgets }: { budgets: BudgetWithCategory[] }) {
  if (budgets.length === 0) {
    return (
      <EmptyState
        title="Belum ada anggaran"
        description="Mulai dari kategori pengeluaran terbesar agar lebih mudah mengontrol pengeluaran."
        action={
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <a className="inline-flex min-h-10 items-center justify-center rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-900/20 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950" href="#budget-form">
              Buat Anggaran
            </a>
            <Link className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-950" href={TRANSACTIONS_ROUTE}>
              Lihat Transaksi
            </Link>
          </div>
        }
      />
    );
  }

  return (
    <Card>
      <SectionHeader title="Daftar Anggaran" description="Anggaran aktif yang digunakan untuk membaca progres di dasbor." />
      <div className="mt-4 grid gap-3">
        {budgets.map((budget) => {
          const deleteAction = deleteBudgetAction.bind(null, budget.id);

          return (
            <form
              action={deleteAction}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-slate-800"
              key={budget.id}
            >
              <div>
                <p className="font-semibold text-slate-950">{budget.category.name}</p>
                <p className="text-sm text-slate-500">
                  {budget.month}/{budget.year} - {formatCurrency(budget.amount.toString())}
                </p>
              </div>
              <Button type="submit" variant="danger">
                Hapus
              </Button>
            </form>
          );
        })}
      </div>
    </Card>
  );
}
