import Link from "next/link";
import type { ReactNode } from "react";

export function QuickActionButton({
  href,
  children,
  icon,
  variant = "primary",
  className = ""
}: {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const variantClassName =
    variant === "primary"
      ? "bg-brand-600 text-white shadow-sm shadow-brand-900/20 hover:bg-brand-700"
      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800";

  return (
    <Link
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-950 ${variantClassName} ${className}`}
      href={href}
    >
      {icon ? <span className="size-4 shrink-0" aria-hidden="true">{icon}</span> : null}
      {children}
    </Link>
  );
}
