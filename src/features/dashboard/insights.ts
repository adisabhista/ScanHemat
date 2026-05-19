import { formatCurrency } from "@/lib/format/currency";

export type DashboardCategoryInsightInput = {
  id?: string;
  name: string;
  total: number;
};

export type DashboardInsight = {
  tone: "info" | "warning" | "success";
  title: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
};

export function getDashboardInsight(categories: DashboardCategoryInsightInput[], totalExpenses: number): DashboardInsight {
  if (categories.length === 0 || totalExpenses <= 0) {
    return {
      tone: "info",
      title: "Insight Bulan Ini",
      message: "Belum ada transaksi pada periode ini. Pindai struk atau tambah transaksi manual agar ringkasan mulai terbentuk."
    };
  }

  const highestCategory = [...categories].sort((a, b) => b.total - a.total)[0];
  const percentage = Math.round((highestCategory.total / totalExpenses) * 100);
  const otherCategory = categories.find((category) => category.name.toLocaleLowerCase("id-ID") === "lainnya");
  const otherPercentage = otherCategory ? Math.round((otherCategory.total / totalExpenses) * 100) : 0;

  if (otherCategory && (highestCategory.id === otherCategory.id || otherPercentage >= 30)) {
    return {
      tone: "warning",
      title: "Insight Bulan Ini",
      message: "Kategori Lainnya masih besar. Tinjau transaksi agar laporan lebih akurat.",
      actionHref: otherCategory.id ? `/transactions?categoryId=${otherCategory.id}` : "/transactions",
      actionLabel: "Tinjau transaksi Lainnya"
    };
  }

  return {
    tone: percentage >= 45 ? "warning" : "success",
    title: "Insight Bulan Ini",
    message: `${highestCategory.name} menyumbang ${percentage}% dari pengeluaran periode ini (${formatCurrency(highestCategory.total)}).`
  };
}
