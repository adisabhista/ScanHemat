import { GoogleDocumentAiOcrProvider } from "@/lib/ocr/google-document-ai-provider";
import {
  type OcrInput,
  type OcrProvider,
  resolveFallbackOcrProviderName,
  resolveOcrProviderName
} from "@/lib/ocr/ocr-provider";
import { TesseractOcrProvider } from "@/lib/ocr/tesseract-ocr-provider";

function createOcrProvider(name = resolveOcrProviderName()): OcrProvider {
  if (name === "tesseract") {
    return new TesseractOcrProvider();
  }

  return new GoogleDocumentAiOcrProvider();
}

export async function extractReceiptText(input: OcrInput) {
  const primaryProvider = createOcrProvider();

  try {
    return await primaryProvider.extractText(input);
  } catch (error) {
    const fallbackProviderName = resolveFallbackOcrProviderName();

    if (!fallbackProviderName || fallbackProviderName === primaryProvider.name) {
      throw error;
    }

    return createOcrProvider(fallbackProviderName).extractText(input);
  }
}
