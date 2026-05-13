import assert from "node:assert/strict";
import test from "node:test";

import { assistantChatReducer, initialAssistantChatState } from "./chat-state";

test("assistant widget is closed by default", () => {
  assert.equal(initialAssistantChatState.isOpen, false);
});

test("assistant widget opens and closes", () => {
  const opened = assistantChatReducer(initialAssistantChatState, { type: "open" });
  const closed = assistantChatReducer(opened, { type: "close" });

  assert.equal(opened.isOpen, true);
  assert.equal(closed.isOpen, false);
});

test("assistant request appends user message immediately and starts loading", () => {
  const state = assistantChatReducer(initialAssistantChatState, { type: "requestStarted", content: "Bulan ini saya boros di mana?" });

  assert.equal(state.messages.length, 1);
  assert.equal(state.messages[0].role, "user");
  assert.equal(state.isSending, true);
  assert.equal(state.input, "");
});

test("assistant request completion appends answer and stops loading", () => {
  const sending = assistantChatReducer(initialAssistantChatState, { type: "requestStarted", content: "Kategori apa yang paling besar?" });
  const completed = assistantChatReducer(sending, { type: "requestCompleted", answer: "Kategori terbesar adalah Makanan." });

  assert.equal(completed.messages.length, 2);
  assert.equal(completed.messages[1].role, "assistant");
  assert.equal(completed.isSending, false);
});

test("assistant request failure keeps user message and shows Indonesian error", () => {
  const sending = assistantChatReducer(initialAssistantChatState, { type: "requestStarted", content: "Apa transaksi kecil yang sering terjadi?" });
  const failed = assistantChatReducer(sending, { type: "requestFailed", error: "Asisten Hemat belum bisa menjawab." });

  assert.equal(failed.messages.length, 1);
  assert.equal(failed.isSending, false);
  assert.equal(failed.error, "Asisten Hemat belum bisa menjawab.");
});
