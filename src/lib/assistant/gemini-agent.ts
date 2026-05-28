import {
  FunctionCallingConfigMode,
  type Content,
  type FunctionCall,
  type GenerateContentResponse
} from "@google/genai";

import { createAiGenerationProvider } from "@/lib/ai/provider-selector";
import { assistantFunctionDeclarations } from "./tool-schemas";
import { assistantSystemPrompt } from "./prompts";
import { buildAssistantContext, buildDeterministicAssistantAnswer } from "./service";
import { executeAssistantTool, getToolResultCount } from "./tools";
import type { AssistantMessage } from "./types";

export type AssistantAgentToolCallDebug = {
  name: string;
  args: Record<string, unknown>;
  resultCount: number;
  transactionCount?: number;
  failed?: boolean;
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
const noDataPeriodAnswer = "Saya tidak menemukan data pada periode tersebut.";
const limitedTransactionThreshold = 3;
const transactionCountToolNames = new Set([
  "getSpendingSummary",
  "getCategoryBreakdown",
  "getMerchantBreakdown",
  "getLargestTransactions",
  "getMonthlyBreakdown",
  "getRecentTransactions",
  "getSmallFrequentTransactions",
  "getItemPriceHistory"
]);

async function createGeminiConfig(): Promise<GeminiConfig | null> {
  try {
    const provider = await createAiGenerationProvider();
    const model = provider.getModel("assistant");

    return {
      model,
      client: {
        models: {
          generateContent: (params) => provider.generateContent(params, { role: "assistant", modelEnvKey: "GEMINI_ASSISTANT_MODEL" })
        }
      }
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Assistant] Gemini provider configuration failed", error);
    }

    return null;
  }
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

function getObjectTransactionCount(value: Record<string, unknown>): number | undefined {
  if (typeof value.transactionCount === "number") {
    return value.transactionCount;
  }

  if (typeof value.count === "number") {
    return value.count;
  }

  if (value.summary && typeof value.summary === "object" && !Array.isArray(value.summary)) {
    return getObjectTransactionCount(value.summary as Record<string, unknown>);
  }

  if (Array.isArray(value.transactions)) {
    return value.transactions.length;
  }

  return undefined;
}

function getToolTransactionCount(name: string, result: unknown): number | undefined {
  if (!transactionCountToolNames.has(name)) {
    return undefined;
  }

  if (Array.isArray(result)) {
    if (result.length === 0) {
      return 0;
    }

    const itemCounts = result
      .map((item) => (item && typeof item === "object" && !Array.isArray(item) ? getObjectTransactionCount(item as Record<string, unknown>) : undefined))
      .filter((count): count is number => typeof count === "number");

    if (itemCounts.length > 0) {
      return itemCounts.reduce((total, count) => total + count, 0);
    }

    return result.length;
  }

  if (result && typeof result === "object") {
    return getObjectTransactionCount(result as Record<string, unknown>);
  }

  return undefined;
}

function formatGuardedAssistantAnswer(answer: string, toolCalls: AssistantAgentToolCallDebug[]) {
  const successfulToolCalls = toolCalls.filter((toolCall) => !toolCall.failed);

  if (successfulToolCalls.some((toolCall) => toolCall.resultCount === 0)) {
    return noDataPeriodAnswer;
  }

  const transactionCounts = successfulToolCalls
    .map((toolCall) => toolCall.transactionCount)
    .filter((count): count is number => typeof count === "number");
  const visibleTransactionCount = transactionCounts.length > 0 ? Math.max(...transactionCounts) : undefined;

  if (
    typeof visibleTransactionCount === "number" &&
    visibleTransactionCount > 0 &&
    visibleTransactionCount < limitedTransactionThreshold &&
    !answer.includes("Saya hanya melihat")
  ) {
    return `Saya hanya melihat ${visibleTransactionCount} transaksi pada periode ini.\n\n${answer}`;
  }

  return answer;
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
  geminiConfig,
  executeTool = executeAssistantTool
}: {
  userId: string;
  messages: AssistantMessage[];
  now?: Date;
  geminiConfig?: GeminiConfig | null;
  executeTool?: AssistantToolExecutor;
}): Promise<AssistantAgentResponse> {
  const resolvedGeminiConfig = geminiConfig === undefined ? await createGeminiConfig() : geminiConfig;

  if (!resolvedGeminiConfig) {
    return fallbackAnswer(userId, messages, now);
  }

  const contents = toGeminiContents(messages);
  const toolCalls: AssistantAgentToolCallDebug[] = [];

  try {
    for (let round = 0; round < maxFunctionCallingRounds; round += 1) {
      const response = await resolvedGeminiConfig.client.models.generateContent({
        model: resolvedGeminiConfig.model,
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
            answer: formatGuardedAssistantAnswer(answer, toolCalls),
            geminiCalled: true,
            fallbackUsed: false,
            model: resolvedGeminiConfig.model,
            toolCalls,
            resolvedPeriod: getResolvedPeriodFromCalls(toolCalls)
          };
        }

        return fallbackAnswer(userId, messages, now, resolvedGeminiConfig.model);
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
              resultCount: getToolResultCount(result),
              transactionCount: getToolTransactionCount(name, result)
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
              resultCount: 0,
              failed: true
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

    return fallbackAnswer(userId, messages, now, resolvedGeminiConfig.model);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Assistant] Gemini function calling failed", error);
    }

    return fallbackAnswer(userId, messages, now, resolvedGeminiConfig.model);
  }
}
