import type { ReactNode } from "react";

import { Card } from "./Card";

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  tone = "brand"
}: {
  title: string;
  value: ReactNode;
  subtitle?: string;
  icon?: ReactNode;
  tone?: "brand" | "sky" | "amber" | "slate";
}) {
  const toneClassName = {
    brand: "bg-brand-50 text-brand-700 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-500/20",
    sky: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-100 dark:ring-sky-500/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-500/20",
    slate: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
  }[tone];

  return (
    <Card className="min-h-36">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <div className="mt-3 text-2xl font-bold tracking-normal text-slate-950 dark:text-slate-50 sm:text-3xl">{value}</div>
        </div>
        {icon ? <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ${toneClassName}`}>{icon}</div> : null}
      </div>
      {subtitle ? <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
    </Card>
  );
}
