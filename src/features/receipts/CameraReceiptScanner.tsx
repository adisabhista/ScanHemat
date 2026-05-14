"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  analyzeImageQuality,
  buildCameraReceiptFileName,
  createReceiptFileFromBlob,
  hasCameraAccessSupport,
  type ImageQualityResult
} from "@/lib/image/client-quality";

type CameraReceiptScannerProps = {
  disabled?: boolean;
  onCancel?: () => void;
  onCapture: (file: File) => void | Promise<void>;
};

const isDevelopment = process.env.NODE_ENV === "development";

function logCamera(message: string, details?: unknown) {
  if (isDevelopment) {
    console.debug(`[Camera] ${message}`, details ?? "");
  }
}

export function CameraReceiptScanner({ disabled = false, onCancel, onCapture }: CameraReceiptScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [qualityResult, setQualityResult] = useState<ImageQualityResult | null>(null);
  const [isOpening, setIsOpening] = useState(true);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    logCamera("camera stopped");
  }, []);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setPreviewUrl("");
    setCapturedBlob(null);
    setQualityResult(null);
  }, []);

  const openCamera = useCallback(async () => {
    setError("");
    setIsOpening(true);

    if (!hasCameraAccessSupport(navigator.mediaDevices)) {
      setError("Browser tidak mendukung akses kamera.");
      setIsOpening(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" }
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      logCamera("camera opened");
    } catch (cameraError) {
      setError("Kamera tidak dapat diakses. Periksa izin kamera browser.");
      logCamera("camera permission denied", cameraError);
    } finally {
      setIsOpening(false);
    }
  }, []);

  useEffect(() => {
    const openTimer = window.setTimeout(() => {
      void openCamera();
    }, 0);

    return () => {
      window.clearTimeout(openTimer);
      stopCamera();
      clearPreview();
    };
  }, [clearPreview, openCamera, stopCamera]);

  async function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Gagal mengambil foto. Coba lagi.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      setError("Gagal mengambil foto. Coba lagi.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const quality = analyzeImageQuality(imageData);
    setQualityResult(quality);
    logCamera("quality checked", {
      brightness: quality.brightness,
      sharpness: quality.sharpness,
      width: quality.width,
      height: quality.height,
      warnings: quality.warnings
    });

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));

    if (!blob) {
      setError("Gagal mengambil foto. Coba lagi.");
      return;
    }

    clearPreview();
    const objectUrl = URL.createObjectURL(blob);
    previewUrlRef.current = objectUrl;
    setCapturedBlob(blob);
    setPreviewUrl(objectUrl);
    stopCamera();
    logCamera("frame captured", { size: blob.size, type: blob.type });
  }

  async function confirmPhoto() {
    if (!capturedBlob || disabled) {
      return;
    }

    const file = createReceiptFileFromBlob(capturedBlob, buildCameraReceiptFileName());
    logCamera("captured image uploaded", { name: file.name, type: file.type, size: file.size });
    await onCapture(file);
  }

  async function retakePhoto() {
    clearPreview();
    await openCamera();
  }

  function cancelCamera() {
    stopCamera();
    clearPreview();
    onCancel?.();
  }

  return (
    <Card>
      <div className="grid gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Pindai Kamera</h2>
          <p className="mt-1 text-sm text-slate-500">Arahkan kamera ke struk.</p>
          <p className="text-sm text-slate-500">Pastikan seluruh struk terlihat.</p>
        </div>

        {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-950">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="Pratinjau foto struk" className="max-h-[70vh] w-full object-contain" src={previewUrl} />
          ) : (
            <video autoPlay className="max-h-[70vh] w-full object-contain" muted playsInline ref={videoRef} />
          )}
        </div>

        {isOpening && !previewUrl ? <p className="text-sm text-slate-500">Membuka kamera...</p> : null}

        {qualityResult ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-950">{qualityResult.message}</p>
            {qualityResult.warnings.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {qualityResult.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          {previewUrl ? (
            <>
              <Button disabled={disabled} onClick={confirmPhoto} type="button">
                Gunakan Foto Ini
              </Button>
              <Button disabled={disabled} onClick={retakePhoto} type="button" variant="secondary">
                Ambil Ulang
              </Button>
            </>
          ) : (
            <Button disabled={disabled || Boolean(error) || isOpening} onClick={captureFrame} type="button">
              Ambil Foto
            </Button>
          )}
          <Button disabled={disabled} onClick={cancelCamera} type="button" variant="secondary">
            Batalkan
          </Button>
        </div>
        <canvas className="hidden" ref={canvasRef} />
      </div>
    </Card>
  );
}
