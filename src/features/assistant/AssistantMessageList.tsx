import type { AssistantChatMessage } from "./chat-state";

const exampleQuestions = [
  "Bulan ini saya boros di mana?",
  "Berapa total belanja Shopee bulan ini?",
  "Kategori apa yang paling besar?",
  "Apa transaksi kecil yang sering terjadi?",
  "Bagaimana cara hemat bulan depan?"
];

export function AssistantMessageList({
  messages,
  isSending,
  onExampleClick
}: {
  messages: AssistantChatMessage[];
  isSending: boolean;
  onExampleClick: (question: string) => void;
}) {
  if (messages.length === 0) {
    return (
      <div className="flex min-h-full flex-col justify-center px-4 py-8 text-center">
        <p className="text-sm font-semibold text-slate-950">Apa yang ingin Anda pahami dari pengeluaran?</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Asisten Hemat menjawab berdasarkan transaksi, kategori, merchant, item, dan anggaran Anda.
        </p>
        <div className="mt-5 grid gap-2">
          {exampleQuestions.map((question) => (
            <button
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium leading-5 text-slate-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
              key={question}
              onClick={() => onExampleClick(question)}
              type="button"
            >
              {question}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {messages.map((message, index) => (
        <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`} key={`${message.role}-${index}`}>
          <div
            className={`max-w-[88%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-6 ${
              message.role === "user" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-800"
            }`}
          >
            {message.content}
          </div>
        </div>
      ))}
      {isSending ? (
        <div className="flex justify-start">
          <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-500">
            Asisten Hemat sedang menganalisis...
          </div>
        </div>
      ) : null}
    </div>
  );
}
