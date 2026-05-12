import { PageHeader } from "@/components/app/PageHeader";
import { Card } from "@/components/ui/Card";
import { getAvailableCategories } from "@/features/categories/queries";
import { requireUserId } from "@/lib/auth";

export default async function CategoriesPage() {
  const userId = await requireUserId();
  const categories = await getAvailableCategories(userId);

  return (
    <>
      <PageHeader title="Kategori" description="Kategori pengeluaran yang tersedia untuk transaksi dan anggaran." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Card className="flex items-center gap-3" key={category.id}>
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color ?? "#64748b" }} />
            <div>
              <p className="font-semibold text-slate-950">{category.name}</p>
              <p className="text-sm text-slate-500">{category.isDefault ? "Kategori bawaan" : "Kategori pribadi"}</p>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
