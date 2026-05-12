"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatCurrency } from "@/lib/format/currency";

export function CategoryChart({ data }: { data: { name: string; total: number }[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500">Belum ada data kategori.</p>;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `${Number(value) / 1000}rb`} />
          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
          <Bar dataKey="total" fill="#059669" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
