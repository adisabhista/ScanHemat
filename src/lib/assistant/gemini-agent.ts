import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  type Content,
  type FunctionCall,
  type GenerateContentResponse
} from "@google/genai";

import { assistantFunctionDeclarations } from "./tool-schemas";
import { assistantSystemPrompt } from "./prompts";
import { buildAssistantContext, buildDeterministicAssistantAnswer } from "./service";
import { executeAssistantTool, getToolResultCount } from "./tools";
import type { AssistantMessage } from "./types";

export type AssistantAgentToolCallDebug = {
  name: string;
  args: Record<string, unknown>;
  resultCount: number;
};

export type AssistantAgentResponse = {
  answer: string;
  geminiCalled: boolean;
  fallbackUsed: boolean;
  model?: string;
  toolCalls: AssistantAgentToolCallDebug[];
  resolvedPeriod?: string;
};

type GeminiModelClient = {
  models: {
    generateContent: (params: {
      model: string;
      contents: Content[];
      config?: Record<string, unknown>;
    }) => Promise<GenerateContentResponse>;
  };
};

type GeminiConfig = {
  client: GeminiModelClient;
  model: string;
};

type AssistantToolExecutor = (userId: string, name: string, args: unknown, now: Date) => Promise<unknown>;

const maxFunctionCallingRounds = 4;

function createGeminiConfig(): GeminiConfig | null {
  const projectId = process.env.GOOGLE_VERTEX_AI_PROJECT_ID?.trim();
  const location = process.env.GOOGLE_VERTEX_AI_LOCATION?.trim();
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const model = process.env.GEMINI_ASSISTANT_MODEL?.trim() || process.env.GEMINI_RECEIPT_MODEL?.trim();

  if (!projectId || !location || !credentials || !model) {
    return null;
  }

  return {
    model,
    client: new GoogleGenAI({
      vertexai: true,
      project: projectId,
      location
    })
  };
}

function toGeminiContents(messages: AssistantMessage[]): Content[] {
  return messages.slice(-10).map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }]
  }));
}

function getCandidateContent(response: GenerateContentResponse, functionCalls: FunctionCall[]): Content {
  const content = response.candidates?.[0]?.content;

  if (content) {
    return content;
  }

  return {
    role: "model",
    parts: functionCalls.map((functionCall) => ({ functionCall }))
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getResolvedPeriodFromCalls(toolCalls: AssistantAgentToolCallDebug[]) {
  const periodCall = toolCalls.find((toolCall) => typeof toolCall.args.period === "string" || typeof toolCall.args.year === "number");

  if (!periodCall) {
    return undefined;
  }

  const { period, month, year, startDate, endDate } = periodCall.args;

  return JSON.stringify({ period, month, year, startDate, endDate });
}

async function fallbackAnswer(userId: string, messages: AssistantMessage[], now: Date, model?: string): Promise<AssistantAgentResponse> {
  const context = await buildAssistantContext(userId, messages, now);

  return {
    answer: buildDeterministicAssistantAnswer(context),
    geminiCalled: false,
    fallbackUsed: true,
    model,
    toolCalls: context.tools.map((name) => ({
      name,
      args: {
        period: context.period.period,
        month: context.period.month,
        year: context.period.year,
        startDate: context.period.startDate,
        endDate: context.period.endDate
      },
      resultCount: context.resultCount ?? 0
    })),
    resolvedPeriod: context.period.periodLabel
  };
}

export async function generateAssistantAgentAnswer({
  userId,
  messages,
  now = new Date(),
  geminiConfig = createGeminiConfig(),
  executeTool = executeAssistantTool
}: {
  userId: string;
  messages: AssistantMessage[];
  now?: Date;
  geminiConfig?: GeminiConfig | null;
  executeTool?: AssistantToolExecutor;
}): Promise<AssistantAgentResponse> {
  if (!geminiConfig) {
    return fallbackAnswer(userId, messages, now);
  }

  const contents = toGeminiContents(messages);
  const toolCalls: AssistantAgentToolCallDebug[] = [];

  try {
    for (let round = 0; round < maxFunctionCallingRounds; round += 1) {
      const response = await geminiConfig.client.models.generateContent({
        model: geminiConfig.model,
        contents,
        config: {
          temperature: 0.2,
          systemInstruction: `${assistantSystemPrompt}\n\nTanggal hari ini: ${now.toISOString().slice(0, 10)}.`,
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.AUTO
            }
          },
          tools: [{ functionDeclarations: assistantFunctionDeclarations }]
        }
      });
      const functionCalls = response.functionCalls ?? [];

      if (functionCalls.length === 0) {
        const answer = response.text?.trim();

        if (answer) {
          return {
            answer,
            geminiCalled: true,
            fallbackUsed: false,
            model: geminiConfig.model,
            toolCalls,
            resolvedPeriod: getResolvedPeriodFromCalls(toolCalls)
          };
        }

        return fallbackAnswer(userId, messages, now, geminiConfig.model);
      }

      contents.push(getCandidateContent(response, functionCalls));

      const responseParts = await Promise.all(
        functionCalls.map(async (functionCall) => {
          const name = functionCall.name ?? "";
          const args = asRecord(functionCall.args);

          try {
            const result = await executeTool(userId, name, args, now);
            toolCalls.push({
              name,
              args,
              resultCount: getToolResultCount(result)
            });

            return {
              functionResponse: {
                id: functionCall.id,
                name,
                response: { output: result }
              }
            };
          } catch (error) {
            toolCalls.push({
              name,
              args,
              resultCount: 0
            });

            return {
              functionResponse: {
                id: functionCall.id,
                name,
                response: {
                  error: error instanceof Error ? error.message : "Tool execution failed"
                }
              }
            };
          }
        })
      );

      contents.push({
        role: "user",
        parts: responseParts
      });
    }

    return fallbackAnswer(userId, messages, now, geminiConfig.model);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Assistant] Gemini function calling failed", error);
    }

    return fallbackAnswer(userId, messages, now, geminiConfig.model);
  }
}
