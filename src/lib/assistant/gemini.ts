import { GoogleGenAI } from "@google/genai";

import { buildDeterministicAssistantAnswer } from "./service";
import type { AssistantContext, AssistantMessage } from "./types";

const systemPrompt = `
You are Asisten Hemat, an Indonesian personal finance assistant inside ScanHemat.
You help users understand their spending based only on provided transaction data.
Do not invent data.
Do not claim certainty if the data is incomplete.
Use Indonesian.
Be practical, frugal, and clear.
When giving financial advice, keep it general and non-professional.
Focus on budgeting, spending awareness, category trends, merchant trends, and saving suggestions.

Formatting:
- Use Rupiah format like Rp54.122.
- Use Indonesian dates like 1 Mei 2026.
- Keep answers concise but useful.
- Use bullet points when helpful.
`;

function createGeminiClient() {
  const projectId = process.env.GOOGLE_VERTEX_AI_PROJECT_ID?.trim();
  const location = process.env.GOOGLE_VERTEX_AI_LOCATION?.trim();
  const model = process.env.GEMINI_RECEIPT_MODEL?.trim() || "gemini-3-flash-preview";

  if (!projectId || !location) {
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

export async function generateAssistantAnswer({
  context,
  messages
}: {
  context: AssistantContext;
  messages: AssistantMessage[];
}) {
  if (context.needsClarification || !context.hasEnoughData) {
    return {
      answer: buildDeterministicAssistantAnswer(context),
      geminiCalled: false
    };
  }

  const gemini = createGeminiClient();

  if (!gemini) {
    return {
      answer: buildDeterministicAssistantAnswer(context),
      geminiCalled: false
    };
  }

  const recentMessages = messages.slice(-6).map((message) => ({
    role: message.role,
    content: message.content
  }));

  const prompt = `${systemPrompt}

Pertanyaan dan konteks chat terbaru:
${JSON.stringify(recentMessages)}

Intent terdeteksi:
${context.intent}

Periode:
${JSON.stringify(context.period)}

Data dari backend ScanHemat:
${JSON.stringify(context.data)}

Tulis jawaban akhir untuk pengguna. Jika data tidak cukup, jawab persis:
Data transaksi belum cukup untuk membuat analisis yang akurat.`;

  try {
    const response = await gemini.client.models.generateContent({
      model: gemini.model,
      contents: prompt,
      config: {
        temperature: 0.2
      }
    });

    const answer = response.text?.trim();

    return {
      answer: answer || buildDeterministicAssistantAnswer(context),
      geminiCalled: true
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Assistant] Gemini answer generation failed", error);
    }

    return {
      answer: buildDeterministicAssistantAnswer(context),
      geminiCalled: false
    };
  }
}
