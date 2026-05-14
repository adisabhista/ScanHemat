"use client";

import type { ChangeEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

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
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          <span>Struk</span>
          <input
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm"
            disabled={disabled}
            onChange={handleFileChange}
            type="file"
          />
          <span className="text-sm font-normal text-slate-500">Unggah foto struk atau PDF struk.</span>
          <span className="text-xs font-normal text-slate-500">Format yang didukung: JPG, PNG, WEBP, atau PDF.</span>
        </label>

        {selectedFile ? (
          <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-950">File dipilih</p>
            <p>{selectedFile.name}</p>
            <p>
              <span className="font-medium">Jenis file:</span> {selectedFile.type || "Tidak diketahui"}
            </p>
            <p>
              <span className="font-medium">Ukuran file:</span> {fileSizeLabel}
            </p>
          </div>
        ) : null}

        {progressLabel ? (
          <div className="rounded-md border border-brand-100 bg-brand-50 p-3">
            <div className="flex items-center justify-between gap-3 text-sm font-medium text-brand-700">
              <span>{progressLabel}</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white">
              <div className="h-2 rounded-full bg-brand-600 transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
          </div>
        ) : null}

        {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

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
