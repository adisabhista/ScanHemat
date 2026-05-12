"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { Worker } from "tesseract.js";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TransactionReviewForm } from "@/features/receipts/TransactionReviewForm";
import type { ParsedReceipt } from "@/lib/parser/receipt-parser";

type CategoryOption = {
  id: string;
  name: string;
};

type UploadResult = {
  receiptId: string;
  filePath: string;
  rawText: string;
  parsed: ParsedReceipt;
};

type UploadedReceipt = {
  receiptId: string;
  filePath: string;
};

type OcrStage = "idle" | "uploading" | "preparing" | "loading-language" | "recognizing" | "processing" | "completed" | "failed";

const ocrTimeoutMs = 60000;
const timeoutMessage = "Gagal membaca struk. Proses OCR terlalu lama. Coba unggah gambar lain atau ulangi lagi.";
const genericOcrMessage = "Gagal membaca struk. Coba unggah gambar yang lebih jelas.";

const stageLabels: Record<OcrStage, string> = {
  idle: "",
  uploading: "Mengunggah struk...",
  preparing: "Menyiapkan OCR...",
  "loading-language": "Memuat data bahasa...",
  recognizing: "Membaca struk...",
  processing: "Memproses hasil...",
  completed: "Selesai membaca struk",
  failed: ""
};

function logOcr(message: string, details?: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.log(`[OCR] ${message}`, details ?? "");
  }
}

function getOcrStageFromStatus(status: string): OcrStage {
  const normalized = status.toLowerCase();

  if (normalized.includes("load") || normalized.includes("initializ")) {
    return "loading-language";
  }

  if (normalized.includes("recogniz")) {
    return "recognizing";
  }

  return "preparing";
}

export function ReceiptUploadForm({ categories }: { categories: CategoryOption[] }) {
  const [result, setResult] = useState<UploadResult | null>(null);
  const [uploadedReceipt, setUploadedReceipt] = useState<UploadedReceipt | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<OcrStage>("idle");
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const cancelledRef = useRef(false);

  async function markReceiptFailed(receiptId: string, message: string) {
    try {
      await fetch(`/api/receipts/${receiptId}/ocr-failed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message })
      });
    } catch (requestError) {
      logOcr("Failed to mark receipt as OCR_FAILED", requestError);
    }
  }

  async function terminateWorker() {
    const worker = workerRef.current;
    workerRef.current = null;

    if (worker) {
      await worker.terminate().catch((terminateError) => {
        logOcr("Worker termination failed", terminateError);
      });
    }
  }

  async function runClientOcr(file: File) {
    const { createWorker } = await import("tesseract.js");
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      setStage("preparing");
      setProgress(0);
      logOcr("Worker creation started");

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          logOcr("OCR timed out after 60 seconds");
          void terminateWorker();
          reject(new Error("OCR_TIMEOUT"));
        }, ocrTimeoutMs);
      });

      const recognitionPromise = (async () => {
        const worker = await createWorker("eng", 1, {
          workerPath: "/tesseract/worker.min.js",
          corePath: "/tesseract/tesseract-core-simd-lstm.wasm.js",
          langPath: "/tesseract/lang",
          workerBlobURL: false,
          gzip: true,
          cacheMethod: "write",
          logger: (message) => {
            const nextStage = getOcrStageFromStatus(message.status);
            setStage(nextStage);
            setProgress(Math.round((message.progress ?? 0) * 100));
            logOcr("Tesseract progress", message);
          },
          errorHandler: (workerError) => {
            logOcr("Tesseract worker error", workerError);
          }
        });

        workerRef.current = worker;
        logOcr("Worker created with language", "eng");

        if (cancelledRef.current) {
          throw new Error("OCR_CANCELLED");
        }

        setStage("recognizing");
        logOcr("OCR recognition started");
        await worker.setParameters({
          preserve_interword_spaces: "1"
        });

        const recognition = await worker.recognize(file);
        logOcr("OCR recognition completed");
        setStage("processing");

        return recognition.data.text.trim();
      })();

      return await Promise.race([recognitionPromise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      await terminateWorker();
    }
  }

  async function saveOcrResult(receiptId: string, rawText: string) {
    const response = await fetch(`/api/receipts/${receiptId}/ocr-result`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ rawText })
    });
    const payload = (await response.json()) as UploadResult | { error?: string };

    if (!response.ok) {
      throw new Error("error" in payload && payload.error ? payload.error : "Gagal menyimpan hasil OCR. Silakan coba lagi.");
    }

    return payload as UploadResult;
  }

  async function processOcr(file: File, receipt: UploadedReceipt) {
    cancelledRef.current = false;
    setIsProcessing(true);
    setError("");
    setResult(null);

    try {
      const rawText = await runClientOcr(file);

      if (cancelledRef.current) {
        throw new Error("OCR_CANCELLED");
      }

      const savedResult = await saveOcrResult(receipt.receiptId, rawText);
      setResult(savedResult);
      setStage("completed");
      setProgress(100);
      logOcr("OCR flow completed");
    } catch (ocrError) {
      const message =
        ocrError instanceof Error && ocrError.message === "OCR_TIMEOUT"
          ? timeoutMessage
          : ocrError instanceof Error && ocrError.message === "OCR_CANCELLED"
            ? "Proses OCR dibatalkan."
            : ocrError instanceof Error && ocrError.message
              ? ocrError.message
              : genericOcrMessage;

      setStage("failed");
      setError(message);
      await markReceiptFailed(receipt.receiptId, message);
      logOcr("OCR flow failed", ocrError);
    } finally {
      await terminateWorker();
      setIsProcessing(false);
    }
  }

  async function uploadReceipt(formData: FormData) {
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setError("Struk wajib diunggah.");
      return;
    }

    setSelectedFile(file);
    setError("");
    setStage("uploading");
    setProgress(0);
    setIsProcessing(true);
    setResult(null);

    try {
      const response = await fetch("/api/receipts/upload", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as UploadedReceipt | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload && payload.error ? payload.error : "Gagal mengunggah struk. Silakan coba lagi.");
      }

      const receipt = payload as UploadedReceipt;
      setUploadedReceipt(receipt);
      await processOcr(file, receipt);
    } catch (uploadError) {
      setStage("failed");
      setError(uploadError instanceof Error && uploadError.message ? uploadError.message : genericOcrMessage);
      logOcr("Receipt upload or OCR failed", uploadError);
    } finally {
      setIsProcessing(false);
    }
  }

  async function cancelOcr() {
    cancelledRef.current = true;
    await terminateWorker();
    setStage("failed");
    setIsProcessing(false);
    setError("Proses OCR dibatalkan.");

    if (uploadedReceipt) {
      await markReceiptFailed(uploadedReceipt.receiptId, "Proses OCR dibatalkan.");
    }
  }

  async function retryOcr() {
    if (!selectedFile || !uploadedReceipt) {
      setError("Unggah struk terlebih dahulu.");
      return;
    }

    await processOcr(selectedFile, uploadedReceipt);
  }

  const progressLabel = stageLabels[stage];
  const canRetry = stage === "failed" && Boolean(selectedFile && uploadedReceipt);

  return (
    <div className="grid gap-6">
      <Card>
        <form action={uploadReceipt} className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            <span>Gambar struk</span>
            <input
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm"
              disabled={isProcessing}
              name="file"
              required
              type="file"
            />
          </label>
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
            <Button disabled={isProcessing} type="submit">
              {isProcessing ? "Membaca struk..." : "Pindai Struk Baru"}
            </Button>
            {isProcessing ? (
              <Button onClick={cancelOcr} type="button" variant="secondary">
                Batalkan
              </Button>
            ) : null}
            {canRetry ? (
              <Button onClick={retryOcr} type="button" variant="secondary">
                Coba Lagi
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      {result ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <h2 className="text-base font-semibold text-slate-950">Hasil OCR</h2>
            <div className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
              <Image
                alt="Pratinjau struk"
                className="h-auto w-full object-contain"
                height={900}
                src={result.filePath}
                width={700}
              />
            </div>
            <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-4 text-xs text-slate-100">
              {result.rawText || "Tidak ada teks terbaca."}
            </pre>
          </Card>
          <TransactionReviewForm categories={categories} parsedReceipt={result.parsed} receiptId={result.receiptId} />
        </div>
      ) : null}
    </div>
  );
}
