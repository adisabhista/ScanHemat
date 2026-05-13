export type OcrProviderName = "google-document-ai" | "tesseract";

export type OcrInput = {
  content: Buffer;
  fileName: string;
  mimeType: string;
};

export type OcrResult = {
  rawText: string;
};

export interface OcrProvider {
  name: OcrProviderName;
  extractText(input: OcrInput): Promise<OcrResult>;
}

type OcrProviderEnv = {
  OCR_PROVIDER?: string;
  OCR_FALLBACK_PROVIDER?: string;
};

export function resolveOcrProviderName(env?: OcrProviderEnv): OcrProviderName {
  const providerValue = env ? env.OCR_PROVIDER : process.env.OCR_PROVIDER;
  const provider = (providerValue ?? "google-document-ai").trim().toLowerCase();

  if (provider === "google-document-ai" || provider === "tesseract") {
    return provider;
  }

  throw new Error(`Unsupported OCR_PROVIDER: ${provider}`);
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

  throw new Error(`Unsupported OCR_FALLBACK_PROVIDER: ${provider}`);
}
