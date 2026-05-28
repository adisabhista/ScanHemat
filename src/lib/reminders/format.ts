import type { Reminder, ReminderStatus, ReminderType, RepeatType } from "@prisma/client";

import { formatCurrency } from "@/lib/format/currency";

export const allowedReminderOffsets = [30, 14, 7, 3, 1, 0] as const;

export type ReminderOffset = (typeof allowedReminderOffsets)[number];

export const reminderTypeLabels: Record<ReminderType, string> = {
  SUBSCRIPTION: "Langganan",
  BILL: "Tagihan",
  VEHICLE_TAX: "Pajak Kendaraan",
  STNK: "STNK",
  SIM: "SIM",
  WARRANTY: "Garansi",
  LICENSE: "Lisensi",
  DOCUMENT: "Dokumen",
  OTHER: "Lainnya"
};

export const repeatTypeLabels: Record<RepeatType, string> = {
  NONE: "Tidak berulang",
  WEEKLY: "Mingguan",
  MONTHLY: "Bulanan",
  YEARLY: "Tahunan",
  CUSTOM: "Kustom"
};

export const reminderStatusLabels: Record<ReminderStatus, string> = {
  ACTIVE: "Aktif",
  DONE: "Selesai",
  DISMISSED: "Diabaikan",
  EXPIRED: "Kedaluwarsa"
};

export const defaultReminderOffsetsByType: Record<ReminderType, ReminderOffset[]> = {
  SUBSCRIPTION: [3, 1, 0],
  BILL: [3, 1, 0],
  VEHICLE_TAX: [30, 14, 7, 1, 0],
  STNK: [30, 14, 7, 1, 0],
  SIM: [30, 14, 7, 1, 0],
  WARRANTY: [30, 7, 0],
  LICENSE: [30, 7, 1, 0],
  DOCUMENT: [30, 7, 1, 0],
  OTHER: [7, 1, 0]
};

export const fallbackReminderOffsets: ReminderOffset[] = [7, 1, 0];

export function formatReminderDate(value: Date | string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(value));
}

export function formatReminderAmount(value: number | string | { toString(): string } | null | undefined) {
  return value == null ? null : formatCurrency(value.toString());
}

function getDefaultReminderOffsets(type?: ReminderType | null) {
  return type && type in defaultReminderOffsetsByType ? [...defaultReminderOffsetsByType[type]] : [...fallbackReminderOffsets];
}

function coerceReminderOffsetInput(offsets: unknown) {
  if (Array.isArray(offsets)) {
    return offsets;
  }

  if (typeof offsets === "string") {
    const trimmed = offsets.trim();

    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

export function normalizeReminderOffsets(offsets: unknown, type?: ReminderType | null) {
  const validOffsets = coerceReminderOffsetInput(offsets)
    .map((offset) => {
      if (typeof offset === "number") {
        return offset;
      }

      if (typeof offset === "string" && offset.trim() !== "") {
        return Number(offset);
      }

      return Number.NaN;
    })
    .filter(
      (offset): offset is ReminderOffset => Number.isInteger(offset) && allowedReminderOffsets.includes(offset as ReminderOffset)
    );
  const uniqueOffsets = Array.from(new Set(validOffsets)).sort((a, b) => b - a);

  if (uniqueOffsets.length > 0) {
    return uniqueOffsets;
  }

  return getDefaultReminderOffsets(type);
}

export function getReminderOffsets(reminder: Pick<Reminder, "type"> & Partial<Pick<Reminder, "reminderOffsets">>) {
  return normalizeReminderOffsets(reminder.reminderOffsets, reminder.type);
}

export function formatReminderOffset(offset: number) {
  if (offset === 0) {
    return "Hari H";
  }

  return `H-${offset}`;
}

export function formatReminderOffsets(offsets: number[]) {
  return offsets.map(formatReminderOffset).join(", ");
}

export function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function addUtcDays(value: Date, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

export function addUtcMonths(value: Date, months: number) {
  const date = new Date(value);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date;
}

export function addUtcYears(value: Date, years: number) {
  const date = new Date(value);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date;
}

export function getCountdownLabel(dueDate: Date | string, now = new Date()) {
  const due = startOfUtcDay(new Date(dueDate));
  const today = startOfUtcDay(now);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (days === 0) {
    return "Hari ini";
  }

  if (days === 1) {
    return "Besok";
  }

  if (days > 1) {
    return `${days} hari lagi`;
  }

  return `Sudah lewat ${Math.abs(days)} hari`;
}

export function getDueDayDifference(dueDate: Date | string, now = new Date()) {
  const due = startOfUtcDay(new Date(dueDate));
  const today = startOfUtcDay(now);

  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function getReminderNotificationLabel(reminder: Pick<Reminder, "title" | "dueDate">, now = new Date()) {
  const days = getDueDayDifference(reminder.dueDate, now);

  if (days < 0) {
    return `${reminder.title} sudah lewat ${Math.abs(days)} hari.`;
  }

  if (days === 0) {
    return `${reminder.title} jatuh tempo hari ini.`;
  }

  if (days === 1) {
    return `${reminder.title} jatuh tempo besok.`;
  }

  return `${reminder.title} jatuh tempo dalam ${days} hari.`;
}

export function getNextDueDate(dueDate: Date, repeatType: RepeatType) {
  if (repeatType === "WEEKLY") {
    return addUtcDays(dueDate, 7);
  }

  if (repeatType === "MONTHLY") {
    return addUtcMonths(dueDate, 1);
  }

  if (repeatType === "YEARLY") {
    return addUtcYears(dueDate, 1);
  }

  return null;
}

export function toReminderPublicItem(reminder: Pick<Reminder, "title" | "type" | "amount" | "dueDate" | "notes">, now = new Date()) {
  return {
    title: reminder.title,
    type: reminderTypeLabels[reminder.type],
    dueDate: reminder.dueDate.toISOString().slice(0, 10),
    amount: reminder.amount == null ? null : Number(reminder.amount),
    countdownLabel: getCountdownLabel(reminder.dueDate, now),
    notes: reminder.notes
  };
}
