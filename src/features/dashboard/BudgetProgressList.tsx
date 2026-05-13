import { BudgetStatusBadge, getBudgetStatus } from "@/features/budgets/BudgetStatusBadge";
import { formatCurrency } from "@/lib/format/currency";

export function BudgetProgressList({
  items
}: {
  items: {
    categoryName: string;
    budgetAmount: number;
    usedAmount: number;
  }[];
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">Belum ada anggaran bulanan.</p>;
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const percentage = item.budgetAmount > 0 ? Math.round((item.usedAmount / item.budgetAmount) * 100) : 0;

        return (
          <div key={item.categoryName}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.categoryName}</p>
                <p className="text-xs text-slate-500">
                  {formatCurrency(item.usedAmount)} dari {formatCurrency(item.budgetAmount)}
                </p>
              </div>
              <BudgetStatusBadge usedPercentage={percentage} />
            </div>
            <div aria-label={getBudgetStatus(percentage)} className="mt-2 h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.min(percentage, 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
