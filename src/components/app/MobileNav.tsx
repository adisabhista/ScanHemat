"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SCAN_RECEIPT_ROUTE } from "@/lib/routes";

const navItems = [
  { href: "/dashboard", label: "Dasbor" },
  { href: SCAN_RECEIPT_ROUTE, label: "Pindai Struk" },
  { href: "/transactions", label: "Transaksi" },
  { href: "/budgets", label: "Anggaran" },
  { href: "/reminders", label: "Pengingat" },
  { href: "/categories", label: "Kategori" },
  { href: "/settings", label: "Pengaturan" }
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:hidden">
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <Link href="/dashboard" className="pt-2 text-base font-bold text-slate-950 dark:text-slate-50">
          ScanHemat
        </Link>
        <div className="flex items-start gap-3">
          <ThemeToggle compact />
          <button
            className="min-h-10 rounded-md px-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
            onClick={() => signOut({ callbackUrl: "/login" })}
            type="button"
          >
            Keluar
          </button>
        </div>
      </div>
      <nav className="flex gap-2 overflow-x-auto px-4 pb-3">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
                active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
