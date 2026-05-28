"use client";

import type { Category } from "@prisma/client";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { FilterCard } from "@/components/ui/FilterCard";
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
  selectedCategoryId,
  selectedSearch,
  selectedNeedsReview
}: {
  categories: Category[];
  selectedPeriod: TransactionPeriod;
  selectedMonth: number;
  selectedYear: number;
  selectedStartDate?: string;
  selectedEndDate?: string;
  selectedCategoryId?: string;
  selectedSearch?: string;
  selectedNeedsReview?: boolean;
}) {
  const [period, setPeriod] = useState<TransactionPeriod>(selectedPeriod);
  const [month, setMonth] = useState(selectedMonth);
  const [year, setYear] = useState(selectedYear);
  const [startDate, setStartDate] = useState(selectedStartDate ?? "");
  const [endDate, setEndDate] = useState(selectedEndDate ?? "");
  const [categoryId, setCategoryId] = useState(selectedCategoryId ?? "");
  const [search, setSearch] = useState(selectedSearch ?? "");
  const [needsReview, setNeedsReview] = useState(selectedNeedsReview ? "1" : "");
  const controls = getVisiblePeriodControls(period);
  const exportParams = useMemo(
    () =>
      buildTransactionFilterSearchParams({
        period,
        month,
        year,
        startDate,
        endDate,
        categoryId,
        search,
        needsReview: needsReview === "1"
      }),
    [categoryId, endDate, month, needsReview, period, search, startDate, year]
  );

  return (
    <FilterCard>
      <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]" method="get">
        <div className="sm:col-span-2 lg:col-span-2">
          <Input
            label="Cari transaksi"
            name="search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari toko, kategori, atau catatan..."
            value={search}
          />
        </div>
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
        <Select value={needsReview} label="Status pengecekan" name="needsReview" onChange={(event) => setNeedsReview(event.target.value)}>
          <option value="">Semua</option>
          <option value="1">Perlu Dicek</option>
        </Select>
        <div className="flex items-end">
          <Button className="w-full" type="submit">
            Terapkan Filter
          </Button>
        </div>
        <div className="flex items-end">
          <a
            className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-950"
            href={`/api/export/transactions?${exportParams.toString()}`}
          >
            Ekspor CSV
          </a>
        </div>
      </form>
    </FilterCard>
  );
}
