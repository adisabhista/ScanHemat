import type { Category } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

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

export function TransactionFilters({
  categories,
  selectedMonth,
  selectedYear,
  selectedCategoryId
}: {
  categories: Category[];
  selectedMonth: number;
  selectedYear: number;
  selectedCategoryId?: string;
}) {
  return (
    <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_1fr_auto_auto]" method="get">
      <Select defaultValue={selectedMonth} label="Bulan" name="month">
        {months.map((month, index) => (
          <option key={month} value={index + 1}>
            {month}
          </option>
        ))}
      </Select>
      <Select defaultValue={selectedYear} label="Tahun" name="year">
        {Array.from({ length: 6 }, (_, index) => selectedYear - 3 + index).map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </Select>
      <Select defaultValue={selectedCategoryId ?? ""} label="Kategori" name="categoryId">
        <option value="">Semua kategori</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>
      <div className="flex items-end">
        <Button className="w-full" type="submit">
          Terapkan
        </Button>
      </div>
      <div className="flex items-end">
        <a
          className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          href={`/api/export/transactions?month=${selectedMonth}&year=${selectedYear}${selectedCategoryId ? `&categoryId=${selectedCategoryId}` : ""}`}
        >
          Ekspor CSV
        </a>
      </div>
    </form>
  );
}
