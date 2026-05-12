"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/dashboard", label: "Dasbor" },
  { href: "/scan", label: "Pindai Struk" },
  { href: "/transactions", label: "Transaksi" },
  { href: "/budgets", label: "Anggaran" },
  { href: "/categories", label: "Kategori" },
  { href: "/settings", label: "Pengaturan" }
];

export function AppSidebar({ userName }: { userName?: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-64 border-r border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:flex lg:flex-col">
      <div className="border-b border-slate-200 px-6 py-5">
        <p className="text-lg font-bold text-slate-950">ScanHemat</p>
        <p className="mt-1 truncate text-sm text-slate-500">{userName ?? "Pengguna"}</p>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium transition ${
                active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <button
          className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-50"
          onClick={() => signOut({ callbackUrl: "/login" })}
          type="button"
        >
          Keluar
        </button>
      </div>
    </aside>
  );
}
