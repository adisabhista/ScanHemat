"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { FloatingAssistantWidget } from "@/features/assistant/FloatingAssistantWidget";

import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { parseSidebarCollapsedValue, serializeSidebarCollapsedValue, sidebarStorageKey } from "./sidebar-state";

export function DashboardShell({
  children,
  userName
}: {
  children: ReactNode;
  userName?: string | null;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsCollapsed(parseSidebarCollapsedValue(window.localStorage.getItem(sidebarStorageKey)));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  function toggleSidebar() {
    setIsCollapsed((currentValue) => {
      const nextValue = !currentValue;
      window.localStorage.setItem(sidebarStorageKey, serializeSidebarCollapsedValue(nextValue));

      return nextValue;
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <AppSidebar isCollapsed={isCollapsed} onToggleCollapsed={toggleSidebar} userName={userName} />
      <MobileNav />
      <main
        className={`px-4 pb-28 pt-6 transition-[margin] duration-200 ease-in-out lg:px-8 ${
          isCollapsed ? "lg:ml-[72px]" : "lg:ml-64"
        }`}
      >
        <div className="mx-auto max-w-7xl space-y-6">{children}</div>
      </main>
      <FloatingAssistantWidget />
    </div>
  );
}
