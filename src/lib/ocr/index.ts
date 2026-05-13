import { GoogleDocumentAiOcrProvider, getGoogleDocumentAiDebugDetails } from "@/lib/ocr/providers/google-document-ai-provider";
import { TesseractOcrProvider } from "@/lib/ocr/tesseract-ocr-provider";
import { type OcrInput, OcrProcessingError, type OcrProvider, type OcrProviderEnv, type OcrProviderName } from "@/lib/ocr/types";

export type { OcrInput, OcrProvider, OcrProviderName, OcrResult } from "@/lib/ocr/types";
export { OcrProcessingError };

export function resolveOcrProviderName(env?: OcrProviderEnv): OcrProviderName {
  const providerValue = env ? env.OCR_PROVIDER : process.env.OCR_PROVIDER;
  const provider = (providerValue ?? "google-document-ai").trim().toLowerCase();

  if (provider === "google-document-ai" || provider === "tesseract") {
    return provider;
  }

  throw new OcrProcessingError({
    code: "configuration",
    message: `Unsupported OCR_PROVIDER: ${provider}`,
    userMessage: "Konfigurasi Google OCR belum lengkap."
  });
}

export function resolveFallbackOcrProviderName(env?: OcrProviderEnv): OcrProviderName | undefined {
  const providerValue = env ? env.OCR_FALLBACK_PROVIDER : process.env.OCR_FALLBACK_PROVIDER;
  const provider = providerValue?.trim().toLowerCase();

  if (!provider) {
    return undefined;
  }

  if (provider === "google-document-ai" || provider === "tesseract") {
    return provider;
  }

  throw new OcrProcessingError({
    code: "configuration",
    message: `Unsupported OCR_FALLBACK_PROVIDER: ${provider}`,
    userMessage: "Konfigurasi Google OCR belum lengkap."
  });
}

function createOcrProvider(name = resolveOcrProviderName()): OcrProvider {
  if (name === "tesseract") {
    return new TesseractOcrProvider();
  }

  return new GoogleDocumentAiOcrProvider();
}

function logOcrError(error: unknown, context: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const details =
    error instanceof OcrProcessingError
      ? {
          code: error.code,
          message: error.message,
          userMessage: error.userMessage,
          ...context,
          ...(error.cause ? getGoogleDocumentAiDebugDetails(error) : {})
        }
      : { error, ...context };

  console.error("[OCR] Provider failed", details);
}

export async function extractReceiptText(input: OcrInput) {
  const primaryProvider = createOcrProvider();

  try {
    return await primaryProvider.extractText(input);
  } catch (error) {
    const fallbackProviderName = resolveFallbackOcrProviderName();

    logOcrError(error, {
      provider: primaryProvider.name,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fallbackProvider: fallbackProviderName
    });

    if (!fallbackProviderName || fallbackProviderName === primaryProvider.name) {
      throw error;
    }

    return createOcrProvider(fallbackProviderName).extractText(input);
  }
}
