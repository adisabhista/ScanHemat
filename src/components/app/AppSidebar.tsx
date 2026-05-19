"use client";

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { ReactNode, SVGProps } from "react";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SCAN_RECEIPT_ROUTE } from "@/lib/routes";

import { SidebarNavItem } from "./SidebarNavItem";

type IconProps = SVGProps<SVGSVGElement>;

type NavItem = {
  href: string;
  icon: (props: IconProps) => ReactNode;
  label: string;
};

const iconClassName = "size-5";

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dasbor", icon: DashboardIcon },
  { href: SCAN_RECEIPT_ROUTE, label: "Pindai Struk", icon: ScanReceiptIcon },
  { href: "/transactions", label: "Transaksi", icon: TransactionIcon },
  { href: "/budgets", label: "Anggaran", icon: BudgetIcon },
  { href: "/reminders", label: "Pengingat", icon: ReminderIcon },
  { href: "/categories", label: "Kategori", icon: CategoryIcon },
  { href: "/settings", label: "Pengaturan", icon: SettingsIcon }
];

export function AppSidebar({
  isCollapsed,
  onToggleCollapsed,
  userName
}: {
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  userName?: string | null;
}) {
  const pathname = usePathname();
  const toggleLabel = isCollapsed ? "Tampilkan menu" : "Sembunyikan menu";

  return (
    <aside
      className={`hidden min-h-screen border-r border-slate-200 bg-white transition-[width] duration-200 ease-in-out dark:border-slate-800 dark:bg-slate-950 lg:fixed lg:inset-y-0 lg:z-30 lg:flex lg:flex-col ${
        isCollapsed ? "w-[72px]" : "w-64"
      }`}
    >
      <div className={`border-b border-slate-200 dark:border-slate-800 ${isCollapsed ? "px-3 py-4" : "px-5 py-5"}`}>
        <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between gap-3"}`}>
          <div className={`flex min-w-0 items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white shadow-sm shadow-brand-900/20">
              {isCollapsed ? "SH" : <ScanReceiptIcon className="size-5" />}
            </div>
            {!isCollapsed ? (
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-slate-950 dark:text-slate-50">ScanHemat</p>
                <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">{userName ?? "Pengguna"}</p>
              </div>
            ) : null}
          </div>
          {!isCollapsed ? <CollapseButton label={toggleLabel} onClick={onToggleCollapsed} /> : null}
        </div>
        {isCollapsed ? (
          <div className="mt-3 flex justify-center">
            <CollapseButton label={toggleLabel} onClick={onToggleCollapsed} />
          </div>
        ) : null}
      </div>

      <nav className={`flex-1 space-y-1 overflow-visible py-4 ${isCollapsed ? "px-2" : "px-3"}`} aria-label="Menu utama">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <SidebarNavItem
              active={active}
              href={item.href}
              icon={item.icon({ className: iconClassName })}
              isCollapsed={isCollapsed}
              key={item.href}
              label={item.label}
            />
          );
        })}
      </nav>

      <div className={`space-y-3 border-t border-slate-200 dark:border-slate-800 ${isCollapsed ? "p-2" : "p-3"}`}>
        <ThemeToggle collapsed={isCollapsed} />
        <button
          aria-label="Keluar"
          className={`group relative flex min-h-11 w-full items-center gap-3 rounded-xl text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-50 dark:focus:ring-offset-slate-950 ${
            isCollapsed ? "justify-center px-2" : "px-3"
          }`}
          onClick={() => signOut({ callbackUrl: "/login" })}
          type="button"
        >
          <LogOutIcon className={iconClassName} aria-hidden="true" />
          {isCollapsed ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-slate-100 dark:text-slate-950"
            >
              Keluar
            </span>
          ) : (
            <span>Keluar</span>
          )}
        </button>
      </div>
    </aside>
  );
}

function CollapseButton({ label, onClick }: { label: string; onClick: () => void }) {
  const isOpenLabel = label === "Tampilkan menu";

  return (
    <button
      aria-label={label}
      className="group relative flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-50 dark:focus:ring-offset-slate-950"
      onClick={onClick}
      title={label}
      type="button"
    >
      {isOpenLabel ? <PanelOpenIcon className="size-5" aria-hidden="true" /> : <PanelCloseIcon className="size-5" aria-hidden="true" />}
      {isOpenLabel ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-slate-100 dark:text-slate-950"
        >
          {label}
        </span>
      ) : null}
    </button>
  );
}

function DashboardIcon(props: IconProps) {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <rect height="7" rx="1.5" width="7" x="3" y="3" />
      <rect height="7" rx="1.5" width="7" x="14" y="3" />
      <rect height="7" rx="1.5" width="7" x="14" y="14" />
      <rect height="7" rx="1.5" width="7" x="3" y="14" />
    </svg>
  );
}

function ScanReceiptIcon(props: IconProps) {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path d="M7 3h10l2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5l2-2Z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </svg>
  );
}

function TransactionIcon(props: IconProps) {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path d="M7 7h13" />
      <path d="m17 4 3 3-3 3" />
      <path d="M17 17H4" />
      <path d="m7 14-3 3 3 3" />
    </svg>
  );
}

function BudgetIcon(props: IconProps) {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path d="M12 3v18" />
      <path d="M17 7.5c0-1.7-1.8-3-4.4-3S8 5.7 8 7.4c0 4.2 9 2.1 9 6.9 0 1.9-1.9 3.2-5 3.2-2.9 0-5-1.2-5-3" />
    </svg>
  );
}

function ReminderIcon(props: IconProps) {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      <path d="M19 3v4" />
      <path d="M21 5h-4" />
    </svg>
  );
}

function CategoryIcon(props: IconProps) {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path d="M20.5 13.5 13.5 20.5a2.1 2.1 0 0 1-3 0L3 13V3h10l7.5 7.5a2.1 2.1 0 0 1 0 3Z" />
      <path d="M7.5 7.5h.01" />
      <path d="m14 6 6 6" />
    </svg>
  );
}

function SettingsIcon(props: IconProps) {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.06.06a2.1 2.1 0 0 1-3 3l-.06-.06a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.65V21a2.1 2.1 0 0 1-4.2 0v-.09A1.8 1.8 0 0 0 8.35 19.3a1.8 1.8 0 0 0-2 .36l-.06.06a2.1 2.1 0 1 1-3-3l.06-.06a1.8 1.8 0 0 0 .36-2A1.8 1.8 0 0 0 2.1 13.5H2a2.1 2.1 0 1 1 0-4.2h.09A1.8 1.8 0 0 0 3.7 8.2a1.8 1.8 0 0 0-.36-2l-.06-.06a2.1 2.1 0 1 1 3-3l.06.06a1.8 1.8 0 0 0 2 .36A1.8 1.8 0 0 0 9.5 2.1V2a2.1 2.1 0 1 1 4.2 0v.09a1.8 1.8 0 0 0 1.1 1.61 1.8 1.8 0 0 0 2-.36l.06-.06a2.1 2.1 0 1 1 3 3l-.06.06a1.8 1.8 0 0 0-.36 2 1.8 1.8 0 0 0 1.65 1.1H21a2.1 2.1 0 1 1 0 4.2h-.09A1.8 1.8 0 0 0 19.4 15Z" />
    </svg>
  );
}

function LogOutIcon(props: IconProps) {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path d="M10 17 15 12 10 7" />
      <path d="M15 12H3" />
      <path d="M21 3v18" />
    </svg>
  );
}

function PanelCloseIcon(props: IconProps) {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <rect height="18" rx="2" width="18" x="3" y="3" />
      <path d="M9 3v18" />
      <path d="m16 10-2 2 2 2" />
    </svg>
  );
}

function PanelOpenIcon(props: IconProps) {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <rect height="18" rx="2" width="18" x="3" y="3" />
      <path d="M9 3v18" />
      <path d="m14 10 2 2-2 2" />
    </svg>
  );
}
