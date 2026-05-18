import type { Reminder } from "@prisma/client";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { deleteReminderAction, dismissReminderAction, markReminderDoneAction } from "@/features/reminders/actions";
import {
  formatReminderAmount,
  formatReminderDate,
  formatReminderOffsets,
  getCountdownLabel,
  getReminderOffsets,
  reminderStatusLabels,
  reminderTypeLabels,
  repeatTypeLabels
} from "@/lib/reminders/format";

export function ReminderList({ reminders }: { reminders: Reminder[] }) {
  if (reminders.length === 0) {
    return <EmptyState title="Belum ada pengingat" description="Tambahkan langganan, tagihan, pajak, SIM, garansi, atau dokumen penting." />;
  }

  return (
    <div className="grid gap-3">
      {reminders.map((reminder) => {
        const doneAction = markReminderDoneAction.bind(null, reminder.id);
        const dismissAction = dismissReminderAction.bind(null, reminder.id);
        const deleteAction = deleteReminderAction.bind(null, reminder.id);
        const amountLabel = formatReminderAmount(reminder.amount);
        const offsetLabel = formatReminderOffsets(getReminderOffsets(reminder));

        return (
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={reminder.id}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-950">{reminder.title}</h2>
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                    {reminderTypeLabels[reminder.type]}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {reminderStatusLabels[reminder.status]}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                  <p>
                    <span className="font-medium text-slate-900">Jatuh tempo:</span> {formatReminderDate(reminder.dueDate)}
                  </p>
                  <p>{getCountdownLabel(reminder.dueDate)}</p>
                  <p>
                    <span className="font-medium text-slate-900">Estimasi biaya:</span> {amountLabel ?? "Belum diisi"}
                  </p>
                  <p>
                    <span className="font-medium text-slate-900">Pengulangan:</span> {repeatTypeLabels[reminder.repeatType]}
                  </p>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  <span className="font-medium text-slate-900">Ingatkan:</span> {offsetLabel}
                </p>
                {reminder.notes ? <p className="mt-3 line-clamp-2 text-sm text-slate-500">{reminder.notes}</p> : null}
                {reminder.relatedMerchant || reminder.relatedDocumentName ? (
                  <p className="mt-2 text-xs text-slate-500">
                    {[reminder.relatedMerchant, reminder.relatedDocumentName].filter(Boolean).join(" - ")}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  href={`/reminders?edit=${reminder.id}`}
                >
                  Ubah
                </Link>
                {reminder.status === "ACTIVE" ? (
                  <>
                    <form action={doneAction}>
                      <Button type="submit" variant="secondary">
                        Tandai Selesai
                      </Button>
                    </form>
                    <form action={dismissAction}>
                      <Button type="submit" variant="ghost">
                        Abaikan
                      </Button>
                    </form>
                  </>
                ) : null}
                <form action={deleteAction}>
                  <Button type="submit" variant="danger">
                    Hapus
                  </Button>
                </form>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
