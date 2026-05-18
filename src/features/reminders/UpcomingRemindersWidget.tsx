import type { Reminder } from "@prisma/client";
import Link from "next/link";

import { Card } from "@/components/ui/Card";
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
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-950">Pengingat Terdekat</h2>
        <Link className="text-sm font-semibold text-brand-700" href="/reminders">
          Lihat semua
        </Link>
      </div>
      {notifications.length > 0 ? (
        <div className="mb-3 grid gap-2">
          {notifications.slice(0, 3).map((notification) => (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900" key={notification.id}>
              {notification.message}
            </p>
          ))}
        </div>
      ) : null}
      {reminders.length === 0 ? (
        <p className="text-sm text-slate-500">Tidak ada pengingat dalam waktu dekat.</p>
      ) : (
        <div className="grid gap-3">
          {reminders.map((reminder) => {
            const amountLabel = formatReminderAmount(reminder.amount);

            return (
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3" key={reminder.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{reminder.title}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatReminderDate(reminder.dueDate)} - {getCountdownLabel(reminder.dueDate)}
                    </p>
                  </div>
                  {amountLabel ? <p className="whitespace-nowrap text-sm font-semibold text-slate-900">{amountLabel}</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
