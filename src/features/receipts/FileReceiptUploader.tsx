"use client";

import type { ChangeEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";

type FileReceiptUploaderProps = {
  canRetry: boolean;
  disabled?: boolean;
  error?: string;
  fileSizeLabel: string;
  onCancel: () => void;
  onFileChange: (file: File | null) => void;
  onRetry: () => void | Promise<void>;
  onScan: () => void | Promise<void>;
  progress: number;
  progressLabel?: string;
  selectedFile: File | null;
};

export function FileReceiptUploader({
  canRetry,
  disabled = false,
  error,
  fileSizeLabel,
  onCancel,
  onFileChange,
  onRetry,
  onScan,
  progress,
  progressLabel,
  selectedFile
}: FileReceiptUploaderProps) {
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    onFileChange(event.target.files?.[0] ?? null);
  }

  return (
    <Card>
      <div className="grid gap-4">
        <SectionHeader title="Unggah Struk" description="Gunakan foto yang terang dan tidak terpotong agar hasil baca lebih rapi." />
        <label className="grid gap-3 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            disabled={disabled}
            onChange={handleFileChange}
            type="file"
          />
          <span className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/10">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-100" aria-hidden="true">
              <UploadIcon />
            </span>
            <span className="mt-4 block text-base font-semibold text-slate-950 dark:text-slate-50">Pilih File Struk</span>
            <span className="mt-1 block text-sm font-normal text-slate-500 dark:text-slate-400">Klik untuk memilih foto struk atau PDF.</span>
            <span className="mt-3 block text-xs font-normal text-slate-500 dark:text-slate-400">JPG, PNG, WEBP, atau PDF</span>
          </span>
        </label>

        {selectedFile ? (
          <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <p className="font-semibold text-slate-950">File dipilih</p>
            <p className="break-all text-base font-semibold text-slate-950 dark:text-slate-100">{selectedFile.name}</p>
            <p>
              <span className="font-medium">Jenis file:</span> {selectedFile.type || "Tidak diketahui"}
            </p>
            <p>
              <span className="font-medium">Ukuran:</span> {fileSizeLabel}
            </p>
          </div>
        ) : null}

        {progressLabel ? (
          <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-500/15">
            <div className="flex items-center justify-between gap-3 text-sm font-medium text-brand-700">
              <span>{progressLabel}</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white">
              <div className="h-2 rounded-full bg-brand-600 transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
          </div>
        ) : null}

        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button disabled={disabled} onClick={onScan} type="button">
            {disabled ? "Membaca struk..." : "Baca Struk"}
          </Button>
          {disabled ? (
            <Button onClick={onCancel} type="button" variant="secondary">
              Batalkan
            </Button>
          ) : null}
          {canRetry ? (
            <Button onClick={onRetry} type="button" variant="secondary">
              Coba Lagi
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function UploadIcon() {
  return (
    <svg className="size-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M20 16v4H4v-4" />
    </svg>
  );
}
