import { PageHeader } from "@/components/app/PageHeader";
import { BudgetForm } from "@/features/budgets/BudgetForm";
import { BudgetList } from "@/features/budgets/BudgetList";
import { getBudgets } from "@/features/budgets/queries";
import { getAvailableCategories } from "@/features/categories/queries";
import { requireUserId } from "@/lib/auth";

type BudgetsPageSearchParams = Promise<{
  error?: string;
}>;

export default async function BudgetsPage({
  searchParams
}: {
  searchParams: BudgetsPageSearchParams;
}) {
  const params = await searchParams;
  const userId = await requireUserId();
  const [categories, budgets] = await Promise.all([getAvailableCategories(userId), getBudgets(userId)]);

  return (
    <>
      <PageHeader title="Anggaran" description="Atur anggaran bulanan per kategori." />
      {params.error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{params.error}</p> : null}
      <BudgetForm categories={categories} />
      <BudgetList budgets={budgets} />
    </>
  );
}
