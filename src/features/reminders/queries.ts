import { Prisma, ReminderStatus, type Reminder, type ReminderType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  addUtcDays,
  getDueDayDifference,
  getReminderNotificationLabel,
  getReminderOffsets,
  startOfUtcDay,
  toReminderPublicItem
} from "@/lib/reminders/format";

export type ReminderFilters = {
  type?: ReminderType;
  status?: ReminderStatus;
};

export function buildReminderWhere(userId: string, filters: ReminderFilters = {}): Prisma.ReminderWhereInput {
  return {
    userId,
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.status ? { status: filters.status } : {})
  };
}

export function sortRemindersByDueDate<T extends Pick<Reminder, "dueDate" | "createdAt">>(reminders: T[]) {
  return [...reminders].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || b.createdAt.getTime() - a.createdAt.getTime());
}

export type ReminderNotification = {
  id: string;
  title: string;
  dueDate: Date;
  daysUntilDue: number;
  message: string;
};

export async function getReminders(userId: string, filters: ReminderFilters = {}) {
  return prisma.reminder.findMany({
    where: buildReminderWhere(userId, filters),
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }]
  });
}

export async function getReminderById(userId: string, id: string) {
  return prisma.reminder.findFirst({
    where: { id, userId }
  });
}

export async function getUpcomingRemindersForDashboard(userId: string, now = new Date(), take = 3) {
  return prisma.reminder.findMany({
    where: {
      userId,
      status: ReminderStatus.ACTIVE,
      dueDate: {
        gte: startOfUtcDay(now)
      }
    },
    orderBy: { dueDate: "asc" },
    take
  });
}

export function buildReminderNotificationsFromReminders(
  reminders: (Pick<Reminder, "id" | "title" | "type" | "dueDate"> & Partial<Pick<Reminder, "reminderOffsets">>)[],
  now = new Date()
): ReminderNotification[] {
  return reminders
    .map((reminder) => {
      const daysUntilDue = getDueDayDifference(reminder.dueDate, now);
      const offsets = getReminderOffsets(reminder);
      const shouldNotify = daysUntilDue < 0 || offsets.includes(daysUntilDue as never);

      if (!shouldNotify) {
        return null;
      }

      return {
        id: reminder.id,
        title: reminder.title,
        dueDate: reminder.dueDate,
        daysUntilDue,
        message: getReminderNotificationLabel(reminder, now)
      };
    })
    .filter((notification): notification is ReminderNotification => Boolean(notification))
    .sort((a, b) => {
      if (a.daysUntilDue < 0 && b.daysUntilDue < 0) {
        return a.daysUntilDue - b.daysUntilDue;
      }

      if (a.daysUntilDue < 0) {
        return -1;
      }

      if (b.daysUntilDue < 0) {
        return 1;
      }

      return a.daysUntilDue - b.daysUntilDue || a.dueDate.getTime() - b.dueDate.getTime();
    });
}

export async function getReminderNotifications(userId: string, now = new Date()) {
  const reminders = await prisma.reminder.findMany({
    where: {
      userId,
      status: ReminderStatus.ACTIVE
    },
    orderBy: { dueDate: "asc" }
  });

  return buildReminderNotificationsFromReminders(reminders, now);
}

export async function getUpcomingReminderRecords(
  userId: string,
  args: {
    period: "week" | "month" | "next30days" | "all";
    type?: ReminderType;
  },
  now = new Date()
) {
  const today = startOfUtcDay(now);
  const where = {
    userId,
    status: ReminderStatus.ACTIVE,
    ...(args.type ? { type: args.type } : {}),
    ...(args.period === "all"
      ? {}
      : {
          dueDate: {
            gte: today,
            lt:
              args.period === "week"
                ? addUtcDays(today, 7)
                : args.period === "next30days"
                  ? addUtcDays(today, 30)
                  : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1))
          }
        })
  };

  return prisma.reminder.findMany({
    where,
    orderBy: { dueDate: "asc" },
    take: args.period === "all" ? 50 : undefined
  });
}

export async function getUpcomingRemindersForAssistant(
  userId: string,
  args: {
    period: "week" | "month" | "next30days" | "all";
    type?: ReminderType;
  },
  now = new Date()
) {
  const reminders = await getUpcomingReminderRecords(userId, args, now);

  return reminders.map((reminder) => toReminderPublicItem(reminder, now));
}

export async function getUpcomingExpenseSummary(userId: string, now = new Date()) {
  const today = startOfUtcDay(now);
  const reminders = await prisma.reminder.findMany({
    where: {
      userId,
      status: ReminderStatus.ACTIVE
    }
  });

  return buildUpcomingExpenseSummaryFromReminders(reminders, today);
}

export function buildUpcomingExpenseSummaryFromReminders(reminders: Pick<Reminder, "amount" | "dueDate">[], now = new Date()) {
  const today = startOfUtcDay(now);
  const next30DaysEnd = addUtcDays(today, 30);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  const next30Days = reminders.filter((reminder) => reminder.dueDate >= today && reminder.dueDate < next30DaysEnd);
  const thisMonth = reminders.filter((reminder) => reminder.dueDate >= monthStart && reminder.dueDate < monthEnd);
  const overdue = reminders.filter((reminder) => reminder.dueDate < today);

  return {
    next30DaysAmount: sumReminderAmounts(next30Days),
    thisMonthAmount: sumReminderAmounts(thisMonth),
    activeReminderCount: reminders.length,
    overdueReminderCount: overdue.length
  };
}

export type RecurringTransactionSuggestion = {
  merchant: string;
  amount: number;
  repeatType: "MONTHLY";
  type: "SUBSCRIPTION" | "BILL";
};

function normalizeMerchant(value: string | null) {
  return value?.toLowerCase().replace(/\s+/g, " ").trim() || "";
}

function isSimilarAmount(base: number, next: number) {
  const difference = Math.abs(base - next);
  return difference <= Math.max(10_000, base * 0.1);
}

export async function getRecurringTransactionSuggestions(userId: string, now = new Date()): Promise<RecurringTransactionSuggestion[]> {
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1));
  const [transactions, existingReminders] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId,
        merchant: { not: null },
        transactionDate: { gte: since }
      },
      orderBy: { transactionDate: "desc" }
    }),
    prisma.reminder.findMany({
      where: {
        userId,
        status: ReminderStatus.ACTIVE,
        type: { in: ["SUBSCRIPTION", "BILL"] }
      },
      select: { relatedMerchant: true, title: true }
    })
  ]);
  const existingNames = new Set(
    existingReminders.flatMap((reminder) => [normalizeMerchant(reminder.relatedMerchant), normalizeMerchant(reminder.title)]).filter(Boolean)
  );
  const byMerchant = transactions.reduce<Record<string, typeof transactions>>((items, transaction) => {
    const merchant = normalizeMerchant(transaction.merchant);

    if (!merchant || existingNames.has(merchant)) {
      return items;
    }

    items[merchant] = [...(items[merchant] ?? []), transaction];
    return items;
  }, {});

  return Object.values(byMerchant)
    .map((items) => {
      const months = new Set(items.map((item) => `${item.transactionDate.getUTCFullYear()}-${item.transactionDate.getUTCMonth()}`));
      const amounts = items.map((item) => Number(item.totalAmount));
      const baseAmount = amounts[0] ?? 0;
      const similarCount = amounts.filter((amount) => isSimilarAmount(baseAmount, amount)).length;

      if (months.size < 2 || similarCount < 2 || baseAmount <= 0) {
        return null;
      }

      const merchant = items[0].merchant ?? "";

      return {
        merchant,
        amount: Math.round(baseAmount),
        repeatType: "MONTHLY" as const,
        type: /youtube|netflix|spotify|google one|icloud|premium|domain|lisensi|license/i.test(merchant) ? "SUBSCRIPTION" as const : "BILL" as const
      };
    })
    .filter((item): item is RecurringTransactionSuggestion => Boolean(item))
    .slice(0, 3);
}

function sumReminderAmounts(reminders: Pick<Reminder, "amount">[]) {
  return reminders.reduce((sum, reminder) => sum + (reminder.amount ?? 0), 0);
}
