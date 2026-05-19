"use client";

import type { ReactNode, SVGProps } from "react";

export type ReceiptInputMode = "manual" | "file" | "camera";

type ReceiptInputModeSelectorProps = {
  disabled?: boolean;
  mode: ReceiptInputMode;
  onModeChange: (mode: ReceiptInputMode) => void;
};

type ModeIconProps = SVGProps<SVGSVGElement>;

const modes: Array<{ value: ReceiptInputMode; label: string; description: string; icon: (props: ModeIconProps) => ReactNode }> = [
  { value: "manual", label: "Input Manual", description: "Untuk transaksi tanpa struk", icon: PencilLineIcon },
  { value: "file", label: "Unggah File", description: "Untuk foto atau PDF e-receipt", icon: UploadCloudIcon },
  { value: "camera", label: "Pindai Kamera", description: "Untuk struk fisik langsung", icon: CameraIcon }
];

export function ReceiptInputModeSelector({ disabled = false, mode, onModeChange }: ReceiptInputModeSelectorProps) {
  return (
    <div className="grid gap-3">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Pilih cara menambahkan transaksi</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {modes.map((inputMode) => {
          const isSelected = inputMode.value === mode;

          return (
            <button
              aria-label={`Pilih mode ${inputMode.label}`}
              aria-pressed={isSelected}
              className={`group min-h-28 rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900 ${
                isSelected
                  ? "border-brand-500 bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-500/20"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
              disabled={disabled}
              key={inputMode.value}
              onClick={() => onModeChange(inputMode.value)}
              type="button"
            >
              <span className="flex items-start gap-3">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition ${
                    isSelected
                      ? "bg-brand-500 text-white shadow-sm dark:bg-brand-400 dark:text-slate-950"
                      : "bg-slate-100 text-slate-700 group-hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:group-hover:bg-slate-700"
                  }`}
                  aria-hidden="true"
                >
                  {inputMode.icon({ className: "size-5" })}
                </span>
                <span>
                  <span className="block font-semibold">{inputMode.label}</span>
                  <span className="mt-1 block text-sm font-normal leading-5 text-slate-500 dark:text-slate-400">{inputMode.description}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PencilLineIcon(props: ModeIconProps) {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function UploadCloudIcon(props: ModeIconProps) {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path d="M12 13v8" />
      <path d="m16 17-4-4-4 4" />
      <path d="M20.4 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 14.9" />
    </svg>
  );
}

function CameraIcon(props: ModeIconProps) {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}
