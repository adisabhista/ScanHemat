import type { Budget, Category } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { deleteBudgetAction } from "@/features/budgets/actions";
import { formatCurrency } from "@/lib/format/currency";

type BudgetWithCategory = Budget & {
  category: Category;
};

export function BudgetList({ budgets }: { budgets: BudgetWithCategory[] }) {
  if (budgets.length === 0) {
    return <EmptyState title="Belum ada anggaran" description="Buat anggaran bulanan untuk memantau batas pengeluaran." />;
  }

  return (
    <div className="grid gap-3">
      {budgets.map((budget) => {
        const deleteAction = deleteBudgetAction.bind(null, budget.id);

        return (
          <form
            action={deleteAction}
            className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
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
  );
}
