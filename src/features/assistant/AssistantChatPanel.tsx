import { AssistantInput } from "./AssistantInput";
import { AssistantMessageList } from "./AssistantMessageList";
import type { AssistantChatMessage } from "./chat-state";

export function AssistantChatPanel({
  messages,
  input,
  isSending,
  error,
  onClose,
  onInputChange,
  onSubmit,
  onExampleClick
}: {
  messages: AssistantChatMessage[];
  input: string;
  isSending: boolean;
  error: string | null;
  onClose: () => void;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onExampleClick: (question: string) => void;
}) {
  return (
    <section className="fixed inset-x-3 bottom-3 z-40 flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[580px] sm:max-h-[640px] sm:w-[400px] dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Asisten Hemat</h2>
          <p className="mt-0.5 text-xs text-slate-500">Tanyakan pengeluaranmu</p>
        </div>
        <button
          aria-label="Tutup Asisten Hemat"
          className="rounded-xl px-2 py-1 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:hover:bg-slate-800"
          onClick={onClose}
          type="button"
        >
          Tutup
        </button>
      </header>

      {error ? <p className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <AssistantMessageList messages={messages} isSending={isSending} onExampleClick={onExampleClick} />
      </div>

      <AssistantInput input={input} isSending={isSending} onInputChange={onInputChange} onSubmit={onSubmit} />
    </section>
  );
}
