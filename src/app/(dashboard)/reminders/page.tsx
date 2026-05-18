import { ReminderStatus, ReminderType, RepeatType } from "@prisma/client";

import { PageHeader } from "@/components/app/PageHeader";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { createReminderAction, updateReminderAction } from "@/features/reminders/actions";
import { RecurringSuggestionList } from "@/features/reminders/RecurringSuggestionList";
import { ReminderForm, type ReminderFormValues } from "@/features/reminders/ReminderForm";
import { ReminderList } from "@/features/reminders/ReminderList";
import {
  getRecurringTransactionSuggestions,
  getReminderById,
  getReminderNotifications,
  getReminders,
  getUpcomingExpenseSummary
} from "@/features/reminders/queries";
import { requireUserId } from "@/lib/auth";
import { formatCurrency } from "@/lib/format/currency";
import { toInputDate } from "@/lib/format/date";
import { reminderStatusLabels, reminderTypeLabels } from "@/lib/reminders/format";

const reminderTypes = Object.values(ReminderType);
const reminderStatuses = Object.values(ReminderStatus);

type RemindersPageSearchParams = Promise<{
  type?: string;
  status?: string;
  edit?: string;
  error?: string;
  title?: string;
  amount?: string;
  repeatType?: string;
  relatedMerchant?: string;
}>;

function parseReminderType(value?: string) {
  return reminderTypes.includes(value as ReminderType) ? (value as ReminderType) : undefined;
}

function parseReminderStatus(value?: string) {
  return reminderStatuses.includes(value as ReminderStatus) ? (value as ReminderStatus) : undefined;
}

function parseRepeatType(value?: string) {
  return Object.values(RepeatType).includes(value as RepeatType) ? (value as RepeatType) : undefined;
}

function parseAmount(value?: string) {
  if (!value) {
    return null;
  }

  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export default async function RemindersPage({ searchParams }: { searchParams: RemindersPageSearchParams }) {
  const params = await searchParams;
  const userId = await requireUserId();
  const filters = {
    type: parseReminderType(params.type),
    status: parseReminderStatus(params.status)
  };
  const [reminders, summary, suggestions, notifications, editReminder] = await Promise.all([
    getReminders(userId, filters),
    getUpcomingExpenseSummary(userId),
    getRecurringTransactionSuggestions(userId),
    getReminderNotifications(userId),
    params.edit ? getReminderById(userId, params.edit) : Promise.resolve(null)
  ]);
  const initialValues: ReminderFormValues = editReminder
    ? {
        title: editReminder.title,
        type: editReminder.type,
        amount: editReminder.amount,
        dueDate: toInputDate(editReminder.dueDate),
        repeatType: editReminder.repeatType,
        reminderOffsets: editReminder.reminderOffsets,
        status: editReminder.status,
        notes: editReminder.notes,
        relatedMerchant: editReminder.relatedMerchant,
        relatedDocumentName: editReminder.relatedDocumentName
      }
    : {
        title: params.title,
        type: parseReminderType(params.type),
        amount: parseAmount(params.amount),
        repeatType: parseRepeatType(params.repeatType),
        relatedMerchant: params.relatedMerchant
      };
  const formAction = editReminder ? updateReminderAction.bind(null, editReminder.id) : createReminderAction;

  return (
    <>
      <PageHeader
        title="Pengingat Cerdas"
        description="Pantau langganan, tagihan, pajak, SIM, garansi, dan dokumen penting yang akan jatuh tempo."
      />

      {params.error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{params.error}</p> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-sm font-medium text-slate-500">Total estimasi pengeluaran 30 hari ke depan</p>
          <p className="mt-3 text-2xl font-bold text-slate-950">{formatCurrency(summary.next30DaysAmount)}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-slate-500">Total estimasi pengeluaran bulan ini</p>
          <p className="mt-3 text-2xl font-bold text-slate-950">{formatCurrency(summary.thisMonthAmount)}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-slate-500">Jumlah pengingat aktif</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{summary.activeReminderCount}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-slate-500">Jumlah yang sudah lewat</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{summary.overdueReminderCount}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-base font-semibold text-slate-950">Notifikasi</h2>
        {notifications.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Tidak ada pengingat dalam waktu dekat.</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {notifications.slice(0, 5).map((notification) => (
              <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700" key={notification.id}>
                {notification.message}
              </p>
            ))}
          </div>
        )}
      </Card>

      <RecurringSuggestionList suggestions={suggestions} />

      <ReminderForm action={formAction} initialValues={initialValues} mode={editReminder ? "edit" : "create"} />

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Pengeluaran wajib mendatang</h2>
            <p className="mt-1 text-sm text-slate-500">Diurutkan dari tanggal jatuh tempo terdekat.</p>
          </div>
          <form className="grid gap-3 sm:grid-cols-[180px_180px_auto]" method="get">
            <Select defaultValue={filters.type ?? ""} label="Jenis" name="type">
              <option value="">Semua jenis</option>
              {reminderTypes.map((type) => (
                <option key={type} value={type}>
                  {reminderTypeLabels[type]}
                </option>
              ))}
            </Select>
            <Select defaultValue={filters.status ?? ""} label="Status" name="status">
              <option value="">Semua status</option>
              {reminderStatuses.map((status) => (
                <option key={status} value={status}>
                  {reminderStatusLabels[status]}
                </option>
              ))}
            </Select>
            <div className="flex items-end gap-2">
              <button className="min-h-10 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700" type="submit">
                Terapkan
              </button>
              <a className="inline-flex min-h-10 items-center rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" href="/reminders">
                Batal
              </a>
            </div>
          </form>
        </div>
      </Card>

      <ReminderList reminders={reminders} />
    </>
  );
}
