import type { ReactNode } from "react";

export type StatusBadgeTone = "brand" | "slate" | "sky" | "amber" | "red" | "emerald";

export function StatusBadge({
  children,
  tone = "slate",
  className = ""
}: {
  children: ReactNode;
  tone?: StatusBadgeTone;
  className?: string;
}) {
  const toneClassName = {
    brand: "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-100",
    slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    sky: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-100",
    amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-100",
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/35 dark:bg-red-500/15 dark:text-red-100",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-100"
  }[tone];

  return <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClassName} ${className}`}>{children}</span>;
}
