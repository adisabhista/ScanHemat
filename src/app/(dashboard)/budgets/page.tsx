import { PageHeader } from "@/components/app/PageHeader";
import { DataCard } from "@/components/ui/DataCard";
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
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Anggaran" description="Atur anggaran bulanan per kategori." />
      {params.error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{params.error}</p> : null}
      <DataCard title="Tips Anggaran" description="Mulai dari batas yang realistis agar kebiasaan mencatat tetap mudah dijalankan.">
        <ul className="grid gap-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          <li>Gunakan rata-rata pengeluaran bulan lalu sebagai patokan.</li>
          <li>Mulai dari kategori Kebutuhan Rumah, Makanan, atau Transportasi.</li>
        </ul>
      </DataCard>
      <BudgetForm categories={categories} />
      <BudgetList budgets={budgets} />
    </div>
  );
}
