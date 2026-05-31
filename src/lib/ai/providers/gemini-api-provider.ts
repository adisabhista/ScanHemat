import { createPartFromBase64, GoogleGenAI } from "@google/genai";
import type { Content, GenerateContentConfig, GenerateContentParameters, GenerateContentResponse } from "@google/genai";

import {
  AiGenerationError,
  getGeminiFallbackModel,
  getGeminiModelForRole,
  getSafeResponsePreview,
  parseJsonObject,
  requireGeminiApiKey,
  type AiGenerationCallDebug,
  type AiGenerateJsonInput,
  type AiGenerateMultimodalJsonInput,
  type AiGenerationModelRole,
  type AiGenerationProvider,
  type AiGenerationProviderName
} from "./generation-provider";

export class GeminiApiProvider implements AiGenerationProvider {
  name: AiGenerationProviderName = "gemini-api";
  private client?: GoogleGenAI;
  private lastCallDebug?: AiGenerationCallDebug;

  getModel(role: AiGenerationModelRole) {
    return getGeminiModelForRole(role);
  }

  getFallbackModel() {
    return getGeminiFallbackModel();
  }

  getLastCallDebug() {
    return this.lastCallDebug;
  }

  async generateContent(
    params: GenerateContentParameters,
    context?: { role?: AiGenerationModelRole; modelEnvKey?: string }
  ): Promise<GenerateContentResponse> {
    const client = this.getClient();
    const primaryModel = params.model;
    const fallbackModel = this.getFallbackModel();

    this.lastCallDebug = {
      provider: this.name,
      primaryModel,
      fallbackModel,
      fallbackUsed: false
    };

    try {
      return await client.models.generateContent(params);
    } catch (error) {
      const primaryError = this.classifyError(error, primaryModel, context?.modelEnvKey);

      if (primaryError.code !== "model-unavailable" || primaryModel === fallbackModel) {
        this.lastCallDebug = {
          provider: this.name,
          primaryModel,
          fallbackModel,
          fallbackUsed: false,
          errorCode: primaryError.code,
          errorMessage: getSafeResponsePreview(primaryError.message)
        };
        throw primaryError;
      }

      try {
        const fallbackResponse = await client.models.generateContent({
          ...params,
          model: fallbackModel
        });

        this.lastCallDebug = {
          provider: this.name,
          primaryModel,
          fallbackModel,
          fallbackUsed: true,
          errorCode: primaryError.code,
          errorMessage: getSafeResponsePreview(primaryError.message)
        };
        console.info(JSON.stringify({
          event: "ai.model.fallback",
          provider: this.name,
          primaryModel,
          fallbackModel,
          fallbackUsed: true,
          errorCode: primaryError.code
        }));

        if (process.env.NODE_ENV === "development") {
          console.warn("[AI] Gemini API model fallback used", this.lastCallDebug);
        }

        return fallbackResponse;
      } catch (fallbackError) {
        const classifiedFallbackError = this.classifyError(fallbackError, fallbackModel, context?.modelEnvKey);

        this.lastCallDebug = {
          provider: this.name,
          primaryModel,
          fallbackModel,
          fallbackUsed: true,
          errorCode: classifiedFallbackError.code,
          errorMessage: getSafeResponsePreview(classifiedFallbackError.message)
        };

        if (classifiedFallbackError.code === "model-unavailable") {
          throw new AiGenerationError({
            code: "model-unavailable",
            provider: this.name,
            model: fallbackModel,
            message: `Primary model ${primaryModel} and fallback model ${fallbackModel} are unavailable.`,
            userMessage: "Model Gemini tidak tersedia. Periksa konfigurasi model AI.",
            cause: fallbackError
          });
        }

        throw classifiedFallbackError;
      }
    }
  }

  async generateText({
    role,
    prompt,
    model = this.getModel(role),
    temperature = 0.2,
    config,
    modelEnvKey
  }: {
    role: AiGenerationModelRole;
    prompt: string | Content[];
    model?: string;
    temperature?: number;
    config?: GenerateContentConfig;
    modelEnvKey?: string;
  }) {
    const response = await this.generateContent(
      {
        model,
        contents: prompt,
        config: {
          temperature,
          ...config
        }
      },
      { role, modelEnvKey }
    );
    const text = response.text?.trim();

    if (!text) {
      throw new AiGenerationError({
        code: "generation-failed",
        provider: this.name,
        model,
        message: "Empty response from Gemini API",
        userMessage: "Gemini menghasilkan respons kosong. Mohon coba lagi."
      });
    }

    return text;
  }

  async generateJson<T>({
    role,
    prompt,
    model = this.getModel(role),
    temperature = 0.1,
    modelEnvKey,
    parse
  }: AiGenerateJsonInput<T>) {
    const text = await this.generateText({
      role,
      prompt,
      model,
      temperature,
      modelEnvKey,
      config: {
        responseMimeType: "application/json"
      }
    });

    return this.parseJsonResponse(text, this.getLastResponseModel(model), parse);
  }

  async generateMultimodalJson<T>({
    role,
    prompt,
    file,
    model = this.getModel(role),
    temperature = 0.1,
    modelEnvKey,
    parse
  }: AiGenerateMultimodalJsonInput<T>) {
    const text = await this.generateText({
      role,
      model,
      temperature,
      modelEnvKey,
      prompt: [
        {
          role: "user",
          parts: [
            { text: prompt },
            createPartFromBase64(file.content.toString("base64"), file.mimeType)
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    return this.parseJsonResponse(text, this.getLastResponseModel(model), parse);
  }

  private getClient() {
    const apiKey = requireGeminiApiKey();

    this.client ??= new GoogleGenAI({ apiKey });

    return this.client;
  }

  private parseJsonResponse<T>(text: string, model: string, parse?: (value: unknown) => T) {
    try {
      const parsed = parseJsonObject(text);
      return parse ? parse(parsed) : (parsed as T);
    } catch (error) {
      const responsePreview = getSafeResponsePreview(text);

      if (process.env.NODE_ENV === "development") {
        console.warn("[AI] Gemini API JSON parse failed", {
          provider: this.name,
          model,
          code: "invalid-json",
          responsePreview
        });
      }

      throw new AiGenerationError({
        code: "invalid-json",
        provider: this.name,
        model,
        message: "Invalid JSON returned from Gemini API",
        userMessage: "Gemini menghasilkan format yang tidak valid. Mohon coba lagi.",
        responsePreview,
        cause: error
      });
    }
  }

  private getLastResponseModel(defaultModel: string) {
    return this.lastCallDebug?.fallbackUsed ? this.lastCallDebug.fallbackModel : defaultModel;
  }

  private classifyError(error: unknown, model?: string, _modelEnvKey = "GEMINI_RECEIPT_MODEL") {
    void _modelEnvKey;

    const message = getErrorMessage(error);
    const status = getErrorStatus(error);
    const lowerMessage = message.toLowerCase();

    if (status === 429 || lowerMessage.includes("rate limit") || lowerMessage.includes("resource exhausted")) {
      return new AiGenerationError({
        code: "rate-limit",
        provider: this.name,
        model,
        message,
        userMessage: "Gemini API sedang membatasi permintaan. Coba lagi nanti.",
        cause: error
      });
    }

    if (
      status === 404 ||
      lowerMessage.includes("not found") ||
      lowerMessage.includes("model not found") ||
      lowerMessage.includes("unsupported model") ||
      lowerMessage.includes("not supported") ||
      (lowerMessage.includes("model") && lowerMessage.includes("unavailable"))
    ) {
      return new AiGenerationError({
        code: "model-unavailable",
        provider: this.name,
        model,
        message,
        userMessage: "Model Gemini tidak tersedia. Periksa konfigurasi model AI.",
        cause: error
      });
    }

    return new AiGenerationError({
      code: "generation-failed",
      provider: this.name,
      model,
      message,
      userMessage: "Layanan Gemini gagal. Silakan coba lagi.",
      cause: error
    });
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message || "Gemini API request failed";
  }

  if (typeof error === "string") {
    return error;
  }

  return "Gemini API request failed";
}

function getErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const record = error as Record<string, unknown>;
  const status = record.status ?? record.code;

  return typeof status === "number" ? status : undefined;
}
