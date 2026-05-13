import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { TransactionPeriod } from "@/features/transactions/queries";

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

export function DashboardPeriodFilter({
  selectedPeriod,
  selectedMonth,
  selectedYear,
  selectedStartDate,
  selectedEndDate
}: {
  selectedPeriod: TransactionPeriod;
  selectedMonth: number;
  selectedYear: number;
  selectedStartDate?: string;
  selectedEndDate?: string;
}) {
  return (
    <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]" method="get">
      <Select defaultValue={selectedPeriod} label="Periode" name="period">
        <option value="month">Bulan Ini</option>
        <option value="year">Tahun Ini</option>
        <option value="all">Semua Waktu</option>
        <option value="custom">Rentang Kustom</option>
      </Select>
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
      <Input defaultValue={selectedStartDate ?? ""} label="Tanggal Mulai" name="startDate" type="date" />
      <Input defaultValue={selectedEndDate ?? ""} label="Tanggal Akhir" name="endDate" type="date" />
      <div className="flex items-end">
        <Button className="w-full" type="submit">
          Terapkan Filter
        </Button>
      </div>
    </form>
  );
}
