"use client";

import { useEffect, useReducer } from "react";

import { AssistantChatPanel } from "./AssistantChatPanel";
import { assistantChatReducer, initialAssistantChatState } from "./chat-state";

export function FloatingAssistantWidget() {
  const [state, dispatch] = useReducer(assistantChatReducer, initialAssistantChatState);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.debug("[Assistant] Widget mounted");
    }
  }, []);

  async function sendMessage(content: string) {
    const trimmedContent = content.trim();

    if (!trimmedContent || state.isSending) {
      return;
    }

    const nextMessages = [...state.messages, { role: "user" as const, content: trimmedContent }];
    dispatch({ type: "requestStarted", content: trimmedContent });

    if (process.env.NODE_ENV === "development") {
      console.debug("[Assistant] Chat request started");
    }

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ messages: nextMessages.slice(-10) })
      });
      const payload = (await response.json()) as {
        answer?: string;
        error?: string;
        debug?: {
          model?: string;
          toolCalls?: Array<{ name: string; resultCount: number }>;
          fallbackUsed?: boolean;
        };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Asisten Hemat belum bisa menjawab.");
      }

      if (process.env.NODE_ENV === "development") {
        console.debug("[Assistant] Chat request completed", {
          model: payload.debug?.model,
          selectedTools: payload.debug?.toolCalls?.map((toolCall) => toolCall.name),
          resultCounts: payload.debug?.toolCalls?.map((toolCall) => toolCall.resultCount),
          fallbackUsed: payload.debug?.fallbackUsed
        });
      }

      dispatch({ type: "requestCompleted", answer: payload.answer ?? "" });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.debug("[Assistant] Chat request completed", { error: true });
      }

      dispatch({
        type: "requestFailed",
        error: error instanceof Error ? error.message : "Asisten Hemat belum bisa menjawab."
      });
    }
  }

  return (
    <>
      {state.isOpen ? (
        <AssistantChatPanel
          error={state.error}
          input={state.input}
          isSending={state.isSending}
          messages={state.messages}
          onClose={() => dispatch({ type: "close" })}
          onExampleClick={(question) => void sendMessage(question)}
          onInputChange={(value) => dispatch({ type: "setInput", value })}
          onSubmit={() => void sendMessage(state.input)}
        />
      ) : (
        <button
          aria-label="Buka Asisten Hemat"
          className="fixed bottom-4 right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-brand-900/25 transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-950 sm:bottom-6 sm:right-6"
          onClick={() => dispatch({ type: "open" })}
          type="button"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-white/15 text-xs font-bold">AI</span>
          Asisten Hemat
          <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-white bg-amber-400 dark:border-slate-950" aria-hidden="true" />
        </button>
      )}
    </>
  );
}
