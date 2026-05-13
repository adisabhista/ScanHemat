export type AssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantChatState = {
  messages: AssistantChatMessage[];
  input: string;
  isOpen: boolean;
  isSending: boolean;
  error: string | null;
};

export type AssistantChatAction =
  | { type: "open" }
  | { type: "close" }
  | { type: "setInput"; value: string }
  | { type: "requestStarted"; content: string }
  | { type: "requestCompleted"; answer: string }
  | { type: "requestFailed"; error: string };

export const initialAssistantChatState: AssistantChatState = {
  messages: [],
  input: "",
  isOpen: false,
  isSending: false,
  error: null
};

export function assistantChatReducer(state: AssistantChatState, action: AssistantChatAction): AssistantChatState {
  if (action.type === "open") {
    return { ...state, isOpen: true };
  }

  if (action.type === "close") {
    return { ...state, isOpen: false };
  }

  if (action.type === "setInput") {
    return { ...state, input: action.value };
  }

  if (action.type === "requestStarted") {
    return {
      ...state,
      messages: [...state.messages, { role: "user", content: action.content }],
      input: "",
      isSending: true,
      error: null
    };
  }

  if (action.type === "requestCompleted") {
    return {
      ...state,
      messages: [...state.messages, { role: "assistant", content: action.answer }],
      isSending: false,
      error: null
    };
  }

  if (action.type === "requestFailed") {
    return {
      ...state,
      isSending: false,
      error: action.error
    };
  }

  return state;
}
