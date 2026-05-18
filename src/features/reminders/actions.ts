"use server";

import { ReminderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getReminderById } from "@/features/reminders/queries";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNextDueDate } from "@/lib/reminders/format";
import { reminderSchema } from "@/lib/validation/reminder";

const REMINDERS_ROUTE = "/reminders";

function parseReminderForm(formData: FormData) {
  return reminderSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    amount: formData.get("amount"),
    dueDate: formData.get("dueDate"),
    reminderOffsets: formData.getAll("reminderOffsets"),
    repeatType: formData.get("repeatType"),
    status: formData.get("status") || ReminderStatus.ACTIVE,
    notes: formData.get("notes"),
    relatedMerchant: formData.get("relatedMerchant"),
    relatedDocumentName: formData.get("relatedDocumentName")
  });
}

function redirectWithError(message: string): never {
  redirect(`${REMINDERS_ROUTE}?error=${encodeURIComponent(message)}`);
}

function revalidateReminderViews() {
  revalidatePath(REMINDERS_ROUTE);
  revalidatePath("/dashboard");
}

export async function createReminderAction(formData: FormData) {
  const userId = await requireUserId();
  const parsed = parseReminderForm(formData);

  if (!parsed.success) {
    redirectWithError(parsed.error.errors[0]?.message ?? "Gagal menyimpan pengingat. Silakan coba lagi.");
  }

  await prisma.reminder.create({
    data: {
      userId,
      title: parsed.data.title,
      type: parsed.data.type,
      amount: parsed.data.amount ?? null,
      dueDate: parsed.data.dueDate,
      reminderOffsets: parsed.data.reminderOffsets,
      repeatType: parsed.data.repeatType,
      status: parsed.data.status,
      notes: parsed.data.notes || null,
      relatedMerchant: parsed.data.relatedMerchant || null,
      relatedDocumentName: parsed.data.relatedDocumentName || null
    }
  });

  revalidateReminderViews();
  redirect(REMINDERS_ROUTE);
}

export async function updateReminderAction(id: string, formData: FormData) {
  const userId = await requireUserId();
  const parsed = parseReminderForm(formData);

  if (!parsed.success) {
    redirectWithError(parsed.error.errors[0]?.message ?? "Gagal menyimpan pengingat. Silakan coba lagi.");
  }

  const existing = await getReminderById(userId, id);

  if (!existing) {
    redirect(REMINDERS_ROUTE);
  }

  await prisma.reminder.update({
    where: { id },
    data: {
      title: parsed.data.title,
      type: parsed.data.type,
      amount: parsed.data.amount ?? null,
      dueDate: parsed.data.dueDate,
      reminderOffsets: parsed.data.reminderOffsets,
      repeatType: parsed.data.repeatType,
      status: parsed.data.status,
      notes: parsed.data.notes || null,
      relatedMerchant: parsed.data.relatedMerchant || null,
      relatedDocumentName: parsed.data.relatedDocumentName || null
    }
  });

  revalidateReminderViews();
  redirect(REMINDERS_ROUTE);
}

export async function markReminderDoneAction(id: string) {
  const userId = await requireUserId();
  const reminder = await getReminderById(userId, id);

  if (reminder) {
    const nextDueDate = getNextDueDate(reminder.dueDate, reminder.repeatType);

    await prisma.reminder.update({
      where: { id },
      data: nextDueDate
        ? {
            dueDate: nextDueDate,
            status: ReminderStatus.ACTIVE
          }
        : {
            status: ReminderStatus.DONE
          }
    });
  }

  revalidateReminderViews();
  redirect(REMINDERS_ROUTE);
}

export async function dismissReminderAction(id: string) {
  const userId = await requireUserId();
  const reminder = await getReminderById(userId, id);

  if (reminder) {
    await prisma.reminder.update({
      where: { id },
      data: { status: ReminderStatus.DISMISSED }
    });
  }

  revalidateReminderViews();
  redirect(REMINDERS_ROUTE);
}

export async function deleteReminderAction(id: string) {
  const userId = await requireUserId();
  const reminder = await getReminderById(userId, id);

  if (reminder) {
    await prisma.reminder.delete({
      where: { id }
    });
  }

  revalidateReminderViews();
  redirect(REMINDERS_ROUTE);
}
