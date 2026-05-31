import { NextResponse } from "next/server";
import { z } from "zod";

import { generateAssistantAgentAnswer } from "@/lib/assistant/gemini-agent";
import { requireUserId } from "@/lib/auth";
import { logServerEvent } from "@/lib/logging/server-log";
import { enforceUserRateLimit } from "@/lib/rate-limit-policy";

export const runtime = "nodejs";

const assistantMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000)
});

const assistantChatRequestSchema = z.object({
  messages: z.array(assistantMessageSchema).min(1).max(20)
});

export async function POST(request: Request) {
  let userId: string;

  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Anda perlu masuk untuk menggunakan Asisten Hemat." }, { status: 401 });
  }

  const rateLimitResponse = enforceUserRateLimit("assistantChat", userId);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = assistantChatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Pesan tidak valid." }, { status: 400 });
  }

  const latestUserMessage = [...parsed.data.messages].reverse().find((message) => message.role === "user");

  if (!latestUserMessage) {
    return NextResponse.json({ error: "Pesan pengguna wajib diisi." }, { status: 400 });
  }

  try {
    const assistantResponse = await generateAssistantAgentAnswer({
      userId,
      messages: parsed.data.messages
    });
    logServerEvent("assistant.chat.completed", {
      toolNames: assistantResponse.toolCalls.map((toolCall) => toolCall.name).join(","),
      fallbackUsed: assistantResponse.fallbackUsed
    });

    if (process.env.NODE_ENV === "development") {
      console.debug("[Assistant] Chat resolved", {
        toolNames: assistantResponse.toolCalls.map((toolCall) => toolCall.name),
        resultCounts: assistantResponse.toolCalls.map((toolCall) => toolCall.resultCount),
        resolvedPeriod: assistantResponse.resolvedPeriod,
        model: assistantResponse.model,
        fallbackUsed: assistantResponse.fallbackUsed,
        geminiCalled: assistantResponse.geminiCalled
      });
    }

    return NextResponse.json({
      answer: assistantResponse.answer,
      debug:
        process.env.NODE_ENV === "development"
          ? {
              model: assistantResponse.model,
              toolCalls: assistantResponse.toolCalls,
              resolvedPeriod: assistantResponse.resolvedPeriod,
              fallbackUsed: assistantResponse.fallbackUsed
            }
          : undefined
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[Assistant] Chat request failed", error);
    }

    return NextResponse.json({ error: "Asisten Hemat belum bisa menjawab. Silakan coba lagi." }, { status: 500 });
  }
}
