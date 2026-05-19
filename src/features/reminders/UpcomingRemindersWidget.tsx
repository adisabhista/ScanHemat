import type { Reminder } from "@prisma/client";
import Link from "next/link";

import { DataCard } from "@/components/ui/DataCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatReminderAmount, formatReminderDate, getCountdownLabel } from "@/lib/reminders/format";
import type { ReminderNotification } from "./queries";

export function UpcomingRemindersWidget({
  reminders,
  notifications = []
}: {
  reminders: Reminder[];
  notifications?: ReminderNotification[];
}) {
  return (
    <DataCard
      title="Pengingat Terdekat"
      description="Tagihan, langganan, dan dokumen yang perlu segera diperhatikan."
      action={
        <Link className="text-sm font-semibold text-brand-700" href="/reminders">
          Lihat semua
        </Link>
      }
    >
      {notifications.length > 0 ? (
        <div className="mb-4 grid gap-2">
          {notifications.slice(0, 3).map((notification) => (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-100" key={notification.id}>
              {notification.message}
            </p>
          ))}
        </div>
      ) : null}
      {reminders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Tidak ada pengingat dalam waktu dekat.
        </p>
      ) : (
        <div className="grid gap-3">
          {reminders.map((reminder) => {
            const amountLabel = formatReminderAmount(reminder.amount);

            return (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800" key={reminder.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{reminder.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge tone="amber">{getCountdownLabel(reminder.dueDate)}</StatusBadge>
                      <span className="text-sm text-slate-500 dark:text-slate-400">{formatReminderDate(reminder.dueDate)}</span>
                    </div>
                  </div>
                  {amountLabel ? <p className="whitespace-nowrap text-sm font-semibold text-slate-900">{amountLabel}</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DataCard>
  );
}
