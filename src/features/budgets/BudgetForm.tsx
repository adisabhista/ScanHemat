import type { Category } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Select } from "@/components/ui/Select";
import { upsertBudgetAction } from "@/features/budgets/actions";

const months = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember"
];

export function BudgetForm({ categories }: { categories: Category[] }) {
  const now = new Date();

  return (
    <div id="budget-form">
      <Card>
        <SectionHeader title="Tambah Anggaran" description="Tetapkan batas bulanan per kategori agar progres pengeluaran lebih mudah dipantau." />
        <form action={upsertBudgetAction} className="mt-4 grid gap-4 md:grid-cols-2">
          <Select label="Kategori" name="categoryId" required>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <Input defaultValue={now.getUTCFullYear()} label="Tahun" name="year" required type="number" />
          <Select defaultValue={now.getUTCMonth() + 1} label="Bulan" name="month" required>
            {months.map((month, index) => (
              <option key={month} value={index + 1}>
                {month}
              </option>
            ))}
          </Select>
          <div>
            <Input label="Nominal" min="0" name="amount" required step="1" type="number" />
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Masukkan nominal Rupiah tanpa titik atau koma.</p>
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Simpan</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
