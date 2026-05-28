import type { Content, GenerateContentConfig, GenerateContentParameters, GenerateContentResponse } from "@google/genai";

export type AiGenerationProviderName = "gemini-api" | "vertex-ai";
export type AiGenerationModelRole = "receipt" | "assistant" | "vision";

export type AiGenerationErrorCode = "configuration" | "model-unavailable" | "invalid-json" | "rate-limit" | "generation-failed";

export const DEFAULT_GEMINI_PRIMARY_MODEL = "gemini-3.5-flash";
export const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-2.5-flash";

export type AiGenerationCallDebug = {
  provider: AiGenerationProviderName;
  primaryModel: string;
  fallbackModel: string;
  fallbackUsed: boolean;
  errorCode?: AiGenerationErrorCode;
  errorMessage?: string;
};

export type GeminiModelEnv = {
  GEMINI_RECEIPT_MODEL?: string;
  GEMINI_ASSISTANT_MODEL?: string;
  GEMINI_VISION_MODEL?: string;
  GEMINI_FALLBACK_MODEL?: string;
};

export class AiGenerationError extends Error {
  code: AiGenerationErrorCode;
  provider: AiGenerationProviderName;
  model?: string;
  userMessage: string;
  responsePreview?: string;

  constructor({
    code,
    message,
    provider,
    model,
    userMessage,
    responsePreview,
    cause
  }: {
    code: AiGenerationErrorCode;
    message: string;
    provider: AiGenerationProviderName;
    model?: string;
    userMessage: string;
    responsePreview?: string;
    cause?: unknown;
  }) {
    super(message, { cause });
    this.name = "AiGenerationError";
    this.code = code;
    this.provider = provider;
    this.model = model;
    this.userMessage = userMessage;
    this.responsePreview = responsePreview;
  }
}

export type AiGenerateJsonInput<T> = {
  role: AiGenerationModelRole;
  prompt: string | Content[];
  model?: string;
  temperature?: number;
  modelEnvKey?: string;
  parse?: (value: unknown) => T;
};

export type AiGenerateMultimodalJsonInput<T> = {
  role: AiGenerationModelRole;
  prompt: string;
  file: {
    content: Buffer;
    mimeType: string;
  };
  model?: string;
  temperature?: number;
  modelEnvKey?: string;
  parse?: (value: unknown) => T;
};

export interface AiGenerationProvider {
  name: AiGenerationProviderName;
  getModel(role: AiGenerationModelRole): string;
  getFallbackModel?(): string;
  getLastCallDebug?(): AiGenerationCallDebug | undefined;
  generateContent(
    params: GenerateContentParameters,
    context?: { role?: AiGenerationModelRole; modelEnvKey?: string }
  ): Promise<GenerateContentResponse>;
  generateText(input: {
    role: AiGenerationModelRole;
    prompt: string | Content[];
    model?: string;
    temperature?: number;
    config?: GenerateContentConfig;
    modelEnvKey?: string;
  }): Promise<string>;
  generateJson<T>(input: AiGenerateJsonInput<T>): Promise<T>;
  generateMultimodalJson<T>(input: AiGenerateMultimodalJsonInput<T>): Promise<T>;
}

export function stripJsonCodeFence(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function parseJsonObject(text: string) {
  const stripped = stripJsonCodeFence(text);
  const direct = tryParseJson(stripped);

  if (direct.ok) {
    return direct.value;
  }

  const match = stripped.match(/\{[\s\S]*\}/);

  if (!match) {
    throw direct.error;
  }

  const extracted = tryParseJson(match[0]);

  if (extracted.ok) {
    return extracted.value;
  }

  throw extracted.error;
}

export function getAiGenerationUserMessage(error: unknown, fallback = "Layanan AI gagal. Silakan coba lagi.") {
  return error instanceof AiGenerationError ? error.userMessage : fallback;
}

export function requireGeminiApiKey(env?: { GEMINI_API_KEY?: string | undefined }) {
  const apiKey = (env?.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY)?.trim();

  if (!apiKey) {
    throw new AiGenerationError({
      code: "configuration",
      provider: "gemini-api",
      message: "Missing GEMINI_API_KEY",
      userMessage: "Konfigurasi Gemini API belum lengkap."
    });
  }

  return apiKey;
}

export function getGeminiFallbackModel(env: GeminiModelEnv = process.env as unknown as GeminiModelEnv) {
  return env.GEMINI_FALLBACK_MODEL?.trim() || DEFAULT_GEMINI_FALLBACK_MODEL;
}

export function getGeminiModelForRole(role: AiGenerationModelRole, env: GeminiModelEnv = process.env as unknown as GeminiModelEnv) {
  const fallbackModel = getGeminiFallbackModel(env);
  const receiptModel = env.GEMINI_RECEIPT_MODEL?.trim() || DEFAULT_GEMINI_PRIMARY_MODEL || fallbackModel;

  if (role === "assistant") {
    return env.GEMINI_ASSISTANT_MODEL?.trim() || receiptModel || fallbackModel;
  }

  if (role === "vision") {
    return env.GEMINI_VISION_MODEL?.trim() || receiptModel || fallbackModel;
  }

  return receiptModel || fallbackModel;
}

export function getSafeResponsePreview(text: string, maxLength = 500) {
  return text.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false; error: Error } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error("Invalid JSON") };
  }
}
