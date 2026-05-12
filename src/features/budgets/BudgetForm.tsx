import type { Category } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
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
    <Card>
      <h2 className="text-base font-semibold text-slate-950">Tambah Anggaran</h2>
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
        <Input label="Nominal" min="0" name="amount" required step="1" type="number" />
        <div className="md:col-span-2">
          <Button type="submit">Simpan</Button>
        </div>
      </form>
    </Card>
  );
}
