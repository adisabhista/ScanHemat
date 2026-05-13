"use client";

import type { Category } from "@prisma/client";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  buildTransactionFilterSearchParams,
  getVisiblePeriodControls,
  type TransactionPeriod
} from "@/features/transactions/period-filter";

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
  selectedPeriod,
  selectedMonth,
  selectedYear,
  selectedStartDate,
  selectedEndDate,
  selectedCategoryId
}: {
  categories: Category[];
  selectedPeriod: TransactionPeriod;
  selectedMonth: number;
  selectedYear: number;
  selectedStartDate?: string;
  selectedEndDate?: string;
  selectedCategoryId?: string;
}) {
  const [period, setPeriod] = useState<TransactionPeriod>(selectedPeriod);
  const [month, setMonth] = useState(selectedMonth);
  const [year, setYear] = useState(selectedYear);
  const [startDate, setStartDate] = useState(selectedStartDate ?? "");
  const [endDate, setEndDate] = useState(selectedEndDate ?? "");
  const [categoryId, setCategoryId] = useState(selectedCategoryId ?? "");
  const controls = getVisiblePeriodControls(period);
  const exportParams = useMemo(
    () =>
      buildTransactionFilterSearchParams({
        period,
        month,
        year,
        startDate,
        endDate,
        categoryId
      }),
    [categoryId, endDate, month, period, startDate, year]
  );

  return (
    <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]" method="get">
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
      <Select value={categoryId} label="Kategori" name="categoryId" onChange={(event) => setCategoryId(event.target.value)}>
        <option value="">Semua kategori</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>
      <div className="flex items-end">
        <Button className="w-full" type="submit">
          Terapkan Filter
        </Button>
      </div>
      <div className="flex items-end">
        <a
          className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          href={`/api/export/transactions?${exportParams.toString()}`}
        >
          Ekspor CSV
        </a>
      </div>
    </form>
  );
}
