"use client";

import Image from "next/image";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
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
  mimeType?: string;
};

type UploadedReceipt = {
  receiptId: string;
  filePath: string;
};

type OcrStage =
  | "idle"
  | "uploading"
  | "reading-pdf"
  | "rendering-pdf"
  | "preparing"
  | "loading-language"
  | "recognizing"
  | "processing"
  | "completed"
  | "failed";

const ocrTimeoutMs = 60000;
const timeoutMessage = "Gagal membaca struk. Proses OCR terlalu lama. Coba unggah gambar lain atau ulangi lagi.";
const genericOcrMessage = "Gagal membaca struk. Coba unggah file lain atau gunakan gambar yang lebih jelas.";
const missingFileMessage = "Pilih file struk terlebih dahulu.";
const unsupportedFileMessage = "Format file tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF.";
const allowedReceiptMimeTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const isDevelopment = process.env.NODE_ENV === "development";

const stageLabels: Record<OcrStage, string> = {
  idle: "",
  uploading: "Memproses file...",
  "reading-pdf": "Membaca PDF...",
  "rendering-pdf": "Mengubah PDF menjadi gambar...",
  preparing: "Menyiapkan OCR...",
  "loading-language": "Memuat data bahasa...",
  recognizing: "Membaca struk...",
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

async function getPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

  return pdfjs;
}

export function ReceiptUploadForm({ categories }: { categories: CategoryOption[] }) {
  const [result, setResult] = useState<UploadResult | null>(null);
  const [uploadedReceipt, setUploadedReceipt] = useState<UploadedReceipt | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<OcrStage>("idle");
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAction, setLastAction] = useState("Halaman scanner aktif");
  const workerRef = useRef<Worker | null>(null);
  const cancelledRef = useRef(false);
  const fileInputMountedRef = useRef(false);

  useEffect(() => {
    logOcr("scanner rendered");
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

  function handleFileInputRef(node: HTMLInputElement | null) {
    if (node && !fileInputMountedRef.current) {
      fileInputMountedRef.current = true;
      setLastAction("Input file siap");
      logOcr("file input mounted");
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    logOcr("file selected");
    setSelectedFile(file);
    setUploadedReceipt(null);
    setResult(null);
    setStage("idle");
    setProgress(0);
    setNotice("");
    setError("");

    if (file) {
      setLastAction("File dipilih");
      logOcr("selected file saved to state", {
        name: file.name,
        type: file.type,
        size: file.size
      });
      logOcr("file name/type/size", {
        name: file.name,
        type: file.type,
        size: file.size
      });
    } else {
      setLastAction("Pilihan file dikosongkan");
    }
  }

  function handleUnexpectedSubmit(event: FormEvent<HTMLDivElement>) {
    logOcr("form submit triggered");
    event.preventDefault();
    logOcr("preventDefault called");
  }

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
      logOcrError("Failed to mark receipt as OCR_FAILED", requestError);
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

  async function runClientOcr(file: File | Blob) {
    const { createWorker } = await import("tesseract.js");
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      setStage("preparing");
      setProgress(0);
      setLastAction("OCR dimulai");
      logOcr("OCR started");
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
        setLastAction("OCR selesai");
        logOcr("OCR completed");
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

  async function renderPdfPageToBlob(file: File): Promise<{ rawText: string } | { imageBlob: Blob }> {
    setStage("reading-pdf");
    setProgress(10);

    try {
      setLastAction("Pemrosesan PDF dimulai");
      logOcr("PDF processing started", {
        name: file.name,
        type: file.type,
        size: file.size
      });
      const pdfjs = await getPdfJs();
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;

      if (pdf.numPages > 1) {
        setNotice("Untuk saat ini, hanya halaman pertama PDF yang akan dibaca.");
      }

      const page = await pdf.getPage(1);
      const textContent = await page.getTextContent();
      const embeddedText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join("\n")
        .trim();

      if (embeddedText) {
        logOcr("PDF processing completed", "embedded text extracted");
        return { rawText: embeddedText };
      }

      setStage("rendering-pdf");
      setProgress(25);

      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("PDF_CANVAS_FAILED");
      }

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      await page.render({ canvas, canvasContext: context, viewport }).promise;

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((renderedBlob) => {
          if (renderedBlob) {
            resolve(renderedBlob);
          } else {
            reject(new Error("PDF_RENDER_FAILED"));
          }
        }, "image/png");
      });

      logOcr("PDF processing completed", "first page rendered");
      return { imageBlob: blob };
    } catch (pdfError) {
      logOcrError("PDF processing failed", pdfError);
      throw new Error("PDF_PROCESSING_FAILED");
    }
  }

  async function extractTextFromFile(file: File) {
    if (file.type !== "application/pdf") {
      setLastAction("Cabang gambar dipilih");
      logOcr("image branch selected", {
        name: file.name,
        type: file.type,
        size: file.size
      });
      return runClientOcr(file);
    }

    setLastAction("Cabang PDF dipilih");
    logOcr("PDF branch selected", {
      name: file.name,
      type: file.type,
      size: file.size
    });
    const pdfResult = await renderPdfPageToBlob(file);

    if ("rawText" in pdfResult) {
      setStage("processing");
      setProgress(90);
      return pdfResult.rawText;
    }

    return runClientOcr(pdfResult.imageBlob);
  }

  async function processOcr(file: File, receipt: UploadedReceipt) {
    cancelledRef.current = false;
    setIsProcessing(true);
    setError("");
    setNotice("");
    setResult(null);

    try {
      const rawText = await extractTextFromFile(file);

      if (cancelledRef.current) {
        throw new Error("OCR_CANCELLED");
      }

      const savedResult = await saveOcrResult(receipt.receiptId, rawText);
      setLastAction("Parser selesai");
      logOcr("parser completed", { receiptId: savedResult.receiptId });
      setResult({ ...savedResult, mimeType: file.type });
      setLastAction("Formulir tinjauan ditampilkan");
      setStage("completed");
      setProgress(100);
      logOcr("OCR flow completed");
    } catch (ocrError) {
      const message =
        ocrError instanceof Error && ocrError.message === "OCR_TIMEOUT"
          ? timeoutMessage
          : ocrError instanceof Error && ocrError.message === "OCR_CANCELLED"
            ? "Proses OCR dibatalkan."
            : genericOcrMessage;

      setStage("failed");
      setError(message);
      setLastAction("Terjadi kesalahan");
      await markReceiptFailed(receipt.receiptId, message);
      logOcrError("error caught", ocrError);
    } finally {
      await terminateWorker();
      setIsProcessing(false);
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

    setLastAction("Validasi berhasil");
    logOcr("validation passed");
    setError("");
    setNotice("");
    setStage("uploading");
    setProgress(0);
    setIsProcessing(true);
    setResult(null);

    try {
      setLastAction("Pemrosesan dimulai");
      logOcr("processing started");
      const formData = new FormData();
      formData.append("file", file);
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
      setLastAction("Terjadi kesalahan");
      logOcrError("error caught", uploadError);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleScan() {
    setLastAction("Tombol Baca Struk diklik");
    logOcr("scan button clicked");
    logOcr("validation started");
    setIsProcessing(true);
    setStage("uploading");
    setProgress(0);
    setError("");
    setNotice("");
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

  async function cancelOcr() {
    cancelledRef.current = true;
    await terminateWorker();
    setStage("failed");
    setIsProcessing(false);
    setError("Proses OCR dibatalkan.");
    setLastAction("Proses OCR dibatalkan");

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
  const debugProcessingState = progressLabel || (isProcessing ? "Memproses file..." : "Menunggu file");

  return (
    <div className="grid gap-6">
      <Card>
        <div className="grid gap-4" onSubmitCapture={handleUnexpectedSubmit}>
          {isDevelopment ? (
            <div className="grid gap-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-950">Halaman scanner aktif</p>
              <p>File: {selectedFile?.name ?? "Belum ada file"}</p>
              <p>Jenis file: {selectedFile?.type ?? "-"}</p>
              <p>Ukuran file: {selectedFile ? getFileSizeLabel(selectedFile.size) : "-"}</p>
              <p>Aksi terakhir: {lastAction}</p>
              <p>Status proses: {debugProcessingState}</p>
            </div>
          ) : null}
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            <span>Struk</span>
            <input
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm"
              disabled={isProcessing}
              onChange={handleFileChange}
              ref={handleFileInputRef}
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
                <span className="font-medium">Ukuran file:</span> {getFileSizeLabel(selectedFile.size)}
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
          {notice ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">{notice}</p> : null}
          {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isProcessing}
              onClick={handleScan}
              type="button"
            >
              {isProcessing ? "Membaca struk..." : "Baca Struk"}
            </button>
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
        </div>
      </Card>

      {result ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <h2 className="text-base font-semibold text-slate-950">Hasil OCR</h2>
            {result.mimeType === "application/pdf" ? (
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">PDF struk sudah diproses dari halaman pertama.</div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                <Image
                  alt="Pratinjau struk"
                  className="h-auto w-full object-contain"
                  height={900}
                  src={result.filePath}
                  width={700}
                />
              </div>
            )}
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
