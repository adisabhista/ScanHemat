import { createWorker } from "tesseract.js";

import type { OcrInput, OcrProvider, OcrResult } from "@/lib/ocr/ocr-provider";

const supportedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export class TesseractOcrProvider implements OcrProvider {
  name = "tesseract" as const;

  async extractText(input: OcrInput): Promise<OcrResult> {
    if (!supportedImageMimeTypes.has(input.mimeType)) {
      throw new Error("Tesseract OCR fallback only supports image receipts.");
    }

    const worker = await createWorker("eng");

    try {
      await worker.setParameters({
        preserve_interword_spaces: "1"
      });

      const recognition = await worker.recognize(input.content);

      return {
        rawText: recognition.data.text.trim()
      };
    } finally {
      await worker.terminate();
    }
  }
}
