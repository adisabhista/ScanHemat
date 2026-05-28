"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ManualTransactionForm } from "@/features/transactions/ManualTransactionForm";
import type { ParsedReceipt } from "@/lib/parser/receipt-parser";
import { CameraReceiptScanner } from "./CameraReceiptScanner";
import { FileReceiptUploader } from "./FileReceiptUploader";
import { ReceiptInputModeSelector, type ReceiptInputMode } from "./ReceiptInputModeSelector";
import { shouldShowScannerDebug } from "./scanner-debug";

type CategoryOption = {
  id: string;
  name: string;
};

type UploadResult = {
  receiptId: string;
  filePath: string;
  mimeType: string;
  parsed: ParsedReceipt;
  ocr?: {
    provider: string;
    confidence?: number;
    pages: number;
  };
};

type UploadErrorResult = {
  error?: string;
  debug?: Record<string, unknown>;
};

type OcrStage = "idle" | "uploading" | "ocr" | "processing" | "completed" | "failed";

const genericOcrMessage = "Gagal membaca struk dengan Google OCR.";
const missingFileMessage = "Pilih file struk terlebih dahulu.";
const unsupportedFileMessage = "Format file tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF.";
const allowedReceiptMimeTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const TransactionReviewForm = dynamic(
  () => import("@/features/receipts/TransactionReviewForm").then((module) => module.TransactionReviewForm),
  {
    loading: () => <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">Memuat formulir tinjauan...</div>,
    ssr: false
  }
);

const stageLabels: Record<OcrStage, string> = {
  idle: "",
  uploading: "Membaca struk...",
  ocr: "Menganalisis total dan item...",
  processing: "Menyiapkan hasil review...",
  completed: "",
  failed: ""
};

function logOcr(message: string, details?: unknown) {
  if (shouldShowScannerDebug()) {
    console.debug(`[OCR] ${message}`, details ?? "");
  }
}

function logOcrError(message: string, details?: unknown) {
  if (shouldShowScannerDebug()) {
    console.error(`[OCR] ${message}`, details ?? "");
  }
}

export function ReceiptUploadForm({ categories }: { categories: CategoryOption[] }) {
  const [mode, setMode] = useState<ReceiptInputMode>("file");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<OcrStage>("idle");
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAction, setLastAction] = useState("Halaman scanner aktif");
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    logOcr("scanner rendered");
    const hydrationTimer = window.setTimeout(() => {
      setLastAction((currentAction) => (currentAction === "Halaman scanner aktif" ? "Komponen client aktif" : currentAction));
      logOcr("client component active");
    }, 0);

    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (result) {
      logOcr("review form shown", { receiptId: result.receiptId });
    }
  }, [result]);

  function getFileSizeLabel(size: number) {
    if (size >= 1024 * 1024) {
      return `${(size / 1024 / 1024).toFixed(2)} MB`;
    }

    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  function isSupportedReceiptFile(file: File) {
    return allowedReceiptMimeTypes.includes(file.type);
  }

  function handleModeChange(nextMode: ReceiptInputMode) {
    setMode(nextMode);
    setResult(null);
    setError("");
    setStage("idle");
    setProgress(0);
    setLastAction(`Mode ${nextMode} dipilih`);
  }

  function handleFileChange(file: File | null) {
    logOcr("file selected");
    setSelectedFile(file);
    setResult(null);
    setStage("idle");
    setProgress(0);
    setError("");

    if (file) {
      setLastAction("File dipilih");
      logOcr("selected file saved to state", {
        name: file.name,
        type: file.type,
        size: file.size
      });
    } else {
      setLastAction("Pilihan file dikosongkan");
    }
  }

  async function uploadReceipt(file: File) {
    setLastAction("Validasi dimulai");
    logOcr("validation started", {
      name: file.name,
      type: file.type,
      size: file.size
    });

    if (file.size === 0) {
      setError(missingFileMessage);
      setStage("failed");
      setIsProcessing(false);
      setLastAction("Validasi gagal");
      return;
    }

    if (!isSupportedReceiptFile(file)) {
      logOcr("Validation failed: unsupported file type", file.type);
      setError(unsupportedFileMessage);
      setStage("failed");
      setIsProcessing(false);
      setLastAction("Validasi gagal");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLastAction("Pemrosesan dimulai");
    setError("");
    setStage("uploading");
    setProgress(25);
    setIsProcessing(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      setStage("ocr");
      setProgress(55);

      const response = await fetch("/api/receipts/upload", {
        method: "POST",
        body: formData,
        signal: controller.signal
      });
      const payload = (await response.json()) as UploadResult | UploadErrorResult;

      if (!response.ok) {
        if (shouldShowScannerDebug() && "debug" in payload && payload.debug) {
          console.error("[OCR] Backend debug", payload.debug);
        }

        throw new Error("error" in payload && payload.error ? payload.error : genericOcrMessage);
      }

      const uploadedResult = payload as UploadResult;
      setStage("processing");
      setProgress(90);
      setResult(uploadedResult);
      setLastAction("Formulir tinjauan ditampilkan");
      setStage("completed");
      setProgress(100);
      logOcr("server OCR flow completed", { receiptId: uploadedResult.receiptId });
    } catch (uploadError) {
      const isAbortError = uploadError instanceof DOMException && uploadError.name === "AbortError";
      const message = isAbortError
        ? "Proses OCR dibatalkan."
        : uploadError instanceof Error && uploadError.message
          ? uploadError.message
          : genericOcrMessage;

      setStage("failed");
      setError(message);
      setLastAction(isAbortError ? "Proses OCR dibatalkan" : "Terjadi kesalahan");
      logOcrError("error caught", uploadError);
    } finally {
      abortControllerRef.current = null;
      setIsProcessing(false);
    }
  }

  async function handleScan() {
    setLastAction("Tombol Baca Struk diklik");
    logOcr("scan button clicked");
    setIsProcessing(true);
    setStage("uploading");
    setProgress(0);
    setError("");
    setResult(null);

    if (!selectedFile) {
      logOcr("Validation failed: no selected file");
      setError(missingFileMessage);
      setStage("failed");
      setIsProcessing(false);
      setLastAction("Validasi gagal");
      return;
    }

    await uploadReceipt(selectedFile);
  }

  async function handleCameraCapture(file: File) {
    setSelectedFile(file);
    await uploadReceipt(file);
  }

  function cancelOcr() {
    abortControllerRef.current?.abort();
    setStage("failed");
    setIsProcessing(false);
    setError("Proses OCR dibatalkan.");
    setLastAction("Proses OCR dibatalkan");
  }

  async function retryOcr() {
    if (!selectedFile) {
      setError("Unggah struk terlebih dahulu.");
      return;
    }

    await uploadReceipt(selectedFile);
  }

  const progressLabel = stageLabels[stage];
  const canRetry = stage === "failed" && Boolean(selectedFile);
  const debugProcessingState = progressLabel || (isProcessing ? "Memproses file..." : "Menunggu file");
  const showScannerDebug = shouldShowScannerDebug();

  return (
    <div className="grid gap-6">
      <Card>
        <div className="grid gap-5">
          <ReceiptStepper stage={stage} hasResult={Boolean(result)} mode={mode} />
          {showScannerDebug ? (
            <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <summary className="cursor-pointer font-semibold text-slate-950 dark:text-slate-100">Debug</summary>
              <div className="mt-3 grid gap-1">
                <p className="font-semibold text-slate-950 dark:text-slate-100">Halaman scanner aktif</p>
                <p>Mode: {mode}</p>
                <p>File: {selectedFile?.name ?? "Belum ada file"}</p>
                <p>Jenis file: {selectedFile?.type ?? "-"}</p>
                <p>Ukuran file: {selectedFile ? getFileSizeLabel(selectedFile.size) : "-"}</p>
                <p>Aksi terakhir: {lastAction}</p>
                <p>Status proses: {debugProcessingState}</p>
              </div>
            </details>
          ) : null}
          <SectionHeader title="Sumber Transaksi" description="Pilih cara yang paling cepat untuk mencatat pengeluaran Anda." />
          <ReceiptInputModeSelector disabled={isProcessing} mode={mode} onModeChange={handleModeChange} />
        </div>
      </Card>

      {mode === "manual" ? <ManualTransactionForm categories={categories} /> : null}

      {mode === "file" ? (
        <FileReceiptUploader
          canRetry={canRetry}
          disabled={isProcessing}
          error={error}
          fileSizeLabel={selectedFile ? getFileSizeLabel(selectedFile.size) : "-"}
          onCancel={cancelOcr}
          onFileChange={handleFileChange}
          onRetry={retryOcr}
          onScan={handleScan}
          progress={progress}
          progressLabel={progressLabel}
          selectedFile={selectedFile}
        />
      ) : null}

      {mode === "camera" ? (
        <>
          <CameraReceiptScanner disabled={isProcessing} onCancel={() => handleModeChange("file")} onCapture={handleCameraCapture} />
          {progressLabel || error ? (
            <Card>
              <div className="grid gap-3">
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
              </div>
            </Card>
          ) : null}
        </>
      ) : null}

      {result ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <SectionHeader title="Pratinjau Struk" description="Gunakan pratinjau ini untuk mencocokkan data sebelum menyimpan." />
            {result.mimeType === "application/pdf" ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">PDF struk sudah diproses di server.</div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                <Image alt="Pratinjau struk" className="h-auto w-full object-contain" height={900} src={result.filePath} width={700} />
              </div>
            )}
          </Card>
          <TransactionReviewForm
            categories={categories}
            mimeType={result.mimeType}
            parsedReceipt={result.parsed}
            receiptId={result.receiptId}
          />
        </div>
      ) : null}
    </div>
  );
}

function ReceiptStepper({
  stage,
  hasResult,
  mode
}: {
  stage: OcrStage;
  hasResult: boolean;
  mode: ReceiptInputMode;
}) {
  const steps = ["Pilih sumber", "Baca struk", "Periksa hasil", "Simpan"];
  const activeIndex = hasResult ? 2 : stage === "uploading" || stage === "ocr" || stage === "processing" ? 1 : mode === "manual" ? 2 : 0;

  return (
    <ol className="grid gap-2 sm:grid-cols-4" aria-label="Langkah pindai struk">
      {steps.map((step, index) => {
        const isActive = index === activeIndex;
        const isComplete = index < activeIndex;

        return (
          <li
            className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
              isActive
                ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-100"
                : isComplete
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100"
                  : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            }`}
            key={step}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold shadow-sm dark:bg-slate-900">
              {index + 1}
            </span>
            <span className="font-semibold">{step}</span>
          </li>
        );
      })}
    </ol>
  );
}
