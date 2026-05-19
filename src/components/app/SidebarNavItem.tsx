"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type SidebarNavItemProps = {
  active: boolean;
  href: string;
  icon: ReactNode;
  isCollapsed: boolean;
  label: string;
};

export function SidebarNavItem({ active, href, icon, isCollapsed, label }: SidebarNavItemProps) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      aria-label={isCollapsed ? label : undefined}
      className={`group relative flex min-h-11 items-center gap-3 rounded-lg text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 ${
        isCollapsed ? "justify-center px-2" : "px-3"
      } ${
        active
          ? "bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-500/20"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-50"
      }`}
      href={href}
    >
      <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden="true">
        {icon}
      </span>
      {isCollapsed ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-slate-100 dark:text-slate-950"
        >
          {label}
        </span>
      ) : (
        <span className="truncate">{label}</span>
      )}
    </Link>
  );
}
