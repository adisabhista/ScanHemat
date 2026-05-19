import { PageHeader } from "@/components/app/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getCategorySummaries } from "@/features/categories/queries";
import { requireUserId } from "@/lib/auth";
import { formatCurrency } from "@/lib/format/currency";
import { TRANSACTIONS_ROUTE } from "@/lib/routes";
import Link from "next/link";

export default async function CategoriesPage() {
  const userId = await requireUserId();
  const categories = await getCategorySummaries(userId);

  return (
    <div className="space-y-6">
      <PageHeader title="Kategori" description="Kelola cara transaksi dikelompokkan agar laporan dan anggaran lebih akurat." />
      {categories.length === 0 ? (
        <EmptyState title="Belum ada kategori" description="Kategori akan membantu memisahkan pengeluaran dan membaca pola belanja Anda." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Card className="flex min-h-44 flex-col justify-between gap-5" key={category.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="size-3 rounded-full" style={{ backgroundColor: category.color ?? "#64748b" }} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{category.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{category.isDefault ? "Kategori bawaan" : "Kategori pribadi"}</p>
                  </div>
                </div>
                <StatusBadge tone={category.monthlyAmount > 0 ? "brand" : "slate"}>{category.transactionCount} transaksi</StatusBadge>
              </div>
              <div>
                <p className="text-sm text-slate-500">Bulan ini</p>
                <p className="mt-1 text-2xl font-bold text-slate-950">{formatCurrency(category.monthlyAmount)}</p>
              </div>
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-700 dark:text-brand-100 dark:hover:bg-brand-500/10 dark:focus:ring-offset-slate-950"
                href={`${TRANSACTIONS_ROUTE}?categoryId=${category.id}`}
              >
                Lihat transaksi
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
