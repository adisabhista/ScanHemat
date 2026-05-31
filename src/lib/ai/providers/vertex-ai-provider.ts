import { createPartFromBase64, GoogleGenAI } from "@google/genai";
import type { Content, GenerateContentConfig, GenerateContentParameters, GenerateContentResponse } from "@google/genai";

import {
  AiGenerationError,
  getGeminiFallbackModel,
  getGeminiModelForRole,
  getSafeResponsePreview,
  parseJsonObject,
  type AiGenerateJsonInput,
  type AiGenerateMultimodalJsonInput,
  type AiGenerationModelRole,
  type AiGenerationProvider,
  type AiGenerationProviderName
} from "./generation-provider";

export class VertexAiProvider implements AiGenerationProvider {
  name: AiGenerationProviderName = "vertex-ai";
  private client?: GoogleGenAI;

  getModel(role: AiGenerationModelRole) {
    return getGeminiModelForRole(role);
  }

  getFallbackModel() {
    return getGeminiFallbackModel();
  }

  async generateContent(
    params: GenerateContentParameters,
    context?: { role?: AiGenerationModelRole; modelEnvKey?: string }
  ): Promise<GenerateContentResponse> {
    const client = this.getClient();

    try {
      return await client.models.generateContent(params);
    } catch (error) {
      throw this.classifyError(error, params.model, context?.modelEnvKey);
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
        message: "Empty response from Vertex AI Gemini",
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

    return this.parseJsonResponse(text, model, parse);
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

    return this.parseJsonResponse(text, model, parse);
  }

  private getClient() {
    const projectId = process.env.GOOGLE_VERTEX_AI_PROJECT_ID?.trim();
    const location = process.env.GOOGLE_VERTEX_AI_LOCATION?.trim();

    if (!projectId || !location) {
      throw new AiGenerationError({
        code: "configuration",
        provider: this.name,
        message: "Missing Vertex AI configuration: GOOGLE_VERTEX_AI_PROJECT_ID or GOOGLE_VERTEX_AI_LOCATION",
        userMessage: "Konfigurasi Vertex AI belum lengkap."
      });
    }

    this.client ??= new GoogleGenAI({
      vertexai: true,
      project: projectId,
      location
    });

    return this.client;
  }

  private parseJsonResponse<T>(text: string, model: string, parse?: (value: unknown) => T) {
    try {
      const parsed = parseJsonObject(text);
      return parse ? parse(parsed) : (parsed as T);
    } catch (error) {
      const responsePreview = getSafeResponsePreview(text);

      if (process.env.NODE_ENV === "development") {
        console.warn("[AI] Vertex AI Gemini JSON parse failed", {
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
        message: "Invalid JSON returned from Vertex AI Gemini",
        userMessage: "Gemini menghasilkan format yang tidak valid. Mohon coba lagi.",
        responsePreview,
        cause: error
      });
    }
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

    if (status === 404 || lowerMessage.includes("not found") || (lowerMessage.includes("model") && lowerMessage.includes("unavailable"))) {
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
    return error.message || "Vertex AI Gemini request failed";
  }

  if (typeof error === "string") {
    return error;
  }

  return "Vertex AI Gemini request failed";
}

function getErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const record = error as Record<string, unknown>;
  const status = record.status ?? record.code;

  return typeof status === "number" ? status : undefined;
}
