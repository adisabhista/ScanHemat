"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

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
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="text-base font-bold text-slate-950">
          ScanHemat
        </Link>
        <button className="text-sm font-semibold text-slate-600" onClick={() => signOut({ callbackUrl: "/login" })} type="button">
          Keluar
        </button>
      </div>
      <nav className="flex gap-2 overflow-x-auto px-4 pb-3">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
                active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
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
