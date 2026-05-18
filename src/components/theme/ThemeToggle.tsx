"use client";

import { useTheme } from "next-themes";
import type { ReactNode, SVGProps } from "react";
import { useEffect, useState } from "react";

import { themeOptions, type ThemeOptionValue } from "@/components/theme/theme-options";

type ThemeToggleProps = {
  compact?: boolean;
};

type ThemeIconProps = SVGProps<SVGSVGElement>;

const iconClassName = "size-4 shrink-0";

const themeIcons: Record<ThemeOptionValue, (props: ThemeIconProps) => ReactNode> = {
  light: (props) => (
    <svg aria-hidden="true" className={iconClassName} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  ),
  dark: (props) => (
    <svg aria-hidden="true" className={iconClassName} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path d="M20.99 12.55A8.5 8.5 0 1 1 11.45 3.01 6.5 6.5 0 0 0 20.99 12.55Z" />
    </svg>
  ),
  system: (props) => (
    <svg aria-hidden="true" className={iconClassName} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <rect height="12" rx="2" width="18" x="3" y="4" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </svg>
  )
};

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setMounted(true), 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const currentTheme = mounted ? (theme as ThemeOptionValue | undefined) ?? "system" : "system";
  const wrapperClassName = compact ? "min-w-0" : "";
  const labelClassName = compact ? "sr-only" : "text-sm font-semibold text-slate-700 dark:text-slate-300";
  const groupClassName = compact
    ? "grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    : "grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900";

  return (
    <div className={`grid gap-1.5 ${wrapperClassName}`} title="Ubah tampilan">
      <span className={labelClassName}>Tampilan</span>
      <div
        aria-label="Ubah tampilan"
        className={`${groupClassName} ${!mounted ? "animate-pulse opacity-70" : ""}`}
        role="radiogroup"
      >
        {themeOptions.map((option) => (
          <button
            aria-checked={currentTheme === option.value}
            aria-label={option.label}
            className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-100 disabled:cursor-not-allowed dark:focus:ring-offset-slate-900 ${
              currentTheme === option.value
                ? "bg-white text-brand-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-brand-100 dark:ring-slate-700"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100"
            }`}
            disabled={!mounted}
            key={option.value}
            onClick={() => setTheme(option.value)}
            role="radio"
            type="button"
          >
            {themeIcons[option.value]({})}
            <span className={compact ? "sr-only sm:not-sr-only" : ""}>{option.value === "system" && compact ? "Sistem" : option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
