"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FilterCard } from "@/components/ui/FilterCard";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { getVisiblePeriodControls, type TransactionPeriod } from "@/features/transactions/period-filter";

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
  const [period, setPeriod] = useState<TransactionPeriod>(selectedPeriod);
  const [month, setMonth] = useState(selectedMonth);
  const [year, setYear] = useState(selectedYear);
  const [startDate, setStartDate] = useState(selectedStartDate ?? "");
  const [endDate, setEndDate] = useState(selectedEndDate ?? "");
  const controls = getVisiblePeriodControls(period);

  return (
    <FilterCard>
      <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]" method="get">
        <Select value={period} label="Periode" name="period" onChange={(event) => setPeriod(event.target.value as TransactionPeriod)}>
          <option value="month">Bulan Ini</option>
          <option value="year">Tahun Ini</option>
          <option value="all">Semua Waktu</option>
          <option value="custom">Rentang Kustom</option>
        </Select>
        {controls.showMonth ? (
          <Select value={month} label="Bulan" name="month" onChange={(event) => setMonth(Number(event.target.value))}>
            {months.map((monthName, index) => (
              <option key={monthName} value={index + 1}>
                {monthName}
              </option>
            ))}
          </Select>
        ) : null}
        {controls.showYear ? (
          <Select value={year} label="Tahun" name="year" onChange={(event) => setYear(Number(event.target.value))}>
            {Array.from({ length: 6 }, (_, index) => year - 3 + index).map((yearOption) => (
              <option key={yearOption} value={yearOption}>
                {yearOption}
              </option>
            ))}
          </Select>
        ) : null}
        {controls.showCustomRange ? (
          <>
            <Input value={startDate} label="Tanggal Mulai" name="startDate" type="date" onChange={(event) => setStartDate(event.target.value)} />
            <Input value={endDate} label="Tanggal Akhir" name="endDate" type="date" onChange={(event) => setEndDate(event.target.value)} />
          </>
        ) : null}
        <div className="flex items-end">
          <Button className="w-full" type="submit">
            Terapkan Filter
          </Button>
        </div>
      </form>
    </FilterCard>
  );
}
