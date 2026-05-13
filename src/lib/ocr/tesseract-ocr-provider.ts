import { createWorker } from "tesseract.js";

import { OcrProcessingError, type OcrInput, type OcrProvider, type OcrResult } from "@/lib/ocr/types";

const supportedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export class TesseractOcrProvider implements OcrProvider {
  name = "tesseract" as const;

  async extractText(input: OcrInput): Promise<OcrResult> {
    if (!supportedImageMimeTypes.has(input.mimeType)) {
      throw new OcrProcessingError({
        code: "unsupported-mime-type",
        message: "Tesseract OCR fallback only supports image receipts.",
        userMessage: "Format file belum didukung oleh Google OCR.",
        statusCode: 400
      });
    }

    const worker = await createWorker("eng");

    try {
      await worker.setParameters({
        preserve_interword_spaces: "1"
      });

      const recognition = await worker.recognize(input.content);

      return {
        rawText: recognition.data.text.trim(),
        provider: this.name,
        confidence: recognition.data.confidence,
        pages: 1
      };
    } finally {
      await worker.terminate();
    }
  }
}
