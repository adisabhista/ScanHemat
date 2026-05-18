import { formatCurrency } from "@/lib/format/currency";
import { reminderTypeLabels } from "@/lib/reminders/format";
import type { RecurringTransactionSuggestion } from "./queries";

export function RecurringSuggestionList({ suggestions }: { suggestions: RecurringTransactionSuggestion[] }) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h2 className="text-base font-semibold text-amber-950">Saran Pengingat</h2>
      <div className="mt-3 grid gap-3">
        {suggestions.map((suggestion) => {
          const params = new URLSearchParams({
            title: suggestion.merchant,
            type: suggestion.type,
            amount: String(suggestion.amount),
            repeatType: suggestion.repeatType,
            relatedMerchant: suggestion.merchant
          });

          return (
            <div className="flex flex-col gap-3 rounded-md bg-white p-3 sm:flex-row sm:items-center sm:justify-between" key={suggestion.merchant}>
              <p className="text-sm text-slate-700">
                Kami menemukan transaksi berulang {suggestion.merchant} sekitar {formatCurrency(suggestion.amount)}/bulan. Buat pengingat{" "}
                {reminderTypeLabels[suggestion.type].toLowerCase()}?
              </p>
              <a
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                href={`/reminders?${params.toString()}`}
              >
                Buat Pengingat
              </a>
            </div>
          );
        })}
      </div>
    </section>
  );
}
