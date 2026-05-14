"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/Card";
import { ManualTransactionForm } from "@/features/transactions/ManualTransactionForm";
import type { ParsedReceipt } from "@/lib/parser/receipt-parser";
import { CameraReceiptScanner } from "./CameraReceiptScanner";
import { FileReceiptUploader } from "./FileReceiptUploader";
import { ReceiptInputModeSelector, type ReceiptInputMode } from "./ReceiptInputModeSelector";

type CategoryOption = {
  id: string;
  name: string;
};

type UploadResult = {
  receiptId: string;
  filePath: string;
  mimeType: string;
  rawText: string;
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
const isDevelopment = process.env.NODE_ENV === "development";

const TransactionReviewForm = dynamic(
  () => import("@/features/receipts/TransactionReviewForm").then((module) => module.TransactionReviewForm),
  {
    loading: () => <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">Memuat formulir tinjauan...</div>,
    ssr: false
  }
);

const stageLabels: Record<OcrStage, string> = {
  idle: "",
  uploading: "Mengunggah struk...",
  ocr: "Membaca struk dengan Google OCR...",
  processing: "Memproses hasil...",
  completed: "Selesai membaca struk",
  failed: ""
};

function logOcr(message: string, details?: unknown) {
  if (isDevelopment) {
    console.debug(`[OCR] ${message}`, details ?? "");
  }
}

function logOcrError(message: string, details?: unknown) {
  if (isDevelopment) {
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
        if (isDevelopment && "debug" in payload && payload.debug) {
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

  return (
    <div className="grid gap-6">
      <Card>
        <div className="grid gap-4">
          {isDevelopment ? (
            <div className="grid gap-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-950">Halaman scanner aktif</p>
              <p>Mode: {mode}</p>
              <p>File: {selectedFile?.name ?? "Belum ada file"}</p>
              <p>Jenis file: {selectedFile?.type ?? "-"}</p>
              <p>Ukuran file: {selectedFile ? getFileSizeLabel(selectedFile.size) : "-"}</p>
              <p>Aksi terakhir: {lastAction}</p>
              <p>Status proses: {debugProcessingState}</p>
            </div>
          ) : null}
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
              </div>
            </Card>
          ) : null}
        </>
      ) : null}

      {result ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <h2 className="text-base font-semibold text-slate-950">Hasil OCR</h2>
            {result.mimeType === "application/pdf" ? (
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">PDF struk sudah diproses di server.</div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                <Image alt="Pratinjau struk" className="h-auto w-full object-contain" height={900} src={result.filePath} width={700} />
              </div>
            )}
            <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-4 text-xs text-slate-100">
              {result.rawText || "Tidak ada teks terbaca."}
            </pre>
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
