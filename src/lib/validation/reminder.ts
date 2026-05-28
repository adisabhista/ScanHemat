import { ReminderStatus, ReminderType, RepeatType } from "@prisma/client";
import { z } from "zod";

import { allowedReminderOffsets, normalizeReminderOffsets } from "@/lib/reminders/format";

const optionalTextSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(1000).optional().nullable()
);

const optionalShortTextSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(200).optional().nullable()
);

const optionalAmountSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().positive("Nominal harus lebih dari 0.").max(2_000_000_000).optional().nullable()
);

const requiredDateSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.date({
    invalid_type_error: "Tanggal jatuh tempo tidak valid.",
    required_error: "Tanggal jatuh tempo wajib diisi."
  })
);

export const reminderOffsetSchema = z.coerce
  .number()
  .int()
  .refine((value) => allowedReminderOffsets.includes(value as never), "Offset pengingat tidak valid.");

export const reminderSchema = z.object({
  title: z.string().trim().min(1, "Judul wajib diisi.").max(200),
  type: z.nativeEnum(ReminderType),
  amount: optionalAmountSchema,
  dueDate: requiredDateSchema,
  reminderOffsets: z.array(reminderOffsetSchema).default([]),
  repeatType: z.nativeEnum(RepeatType),
  status: z.nativeEnum(ReminderStatus).default(ReminderStatus.ACTIVE),
  notes: optionalTextSchema,
  relatedMerchant: optionalShortTextSchema,
  relatedDocumentName: optionalShortTextSchema
}).transform((value) => ({
  ...value,
  reminderOffsets: normalizeReminderOffsets(value.reminderOffsets, value.type)
}));

export const reminderFilterSchema = z.object({
  type: z.nativeEnum(ReminderType).optional(),
  status: z.nativeEnum(ReminderStatus).optional()
});

export const reminderDraftSchema = z.object({
  text: z.string().trim().min(1, "Teks pengingat wajib diisi.").max(500)
});
