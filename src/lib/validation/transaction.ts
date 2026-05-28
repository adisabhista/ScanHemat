import { z } from "zod";

const moneySchema = z.coerce
  .number({
    invalid_type_error: "Nominal harus lebih dari 0."
  })
  .positive("Nominal harus lebih dari 0.");

const requiredTotalAmountSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce
    .number({
      invalid_type_error: "Total transaksi wajib diisi.",
      required_error: "Total transaksi wajib diisi."
    })
    .positive("Nominal harus lebih dari 0.")
);

const requiredTransactionDateSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.date({
    invalid_type_error: "Tanggal transaksi tidak valid.",
    required_error: "Tanggal transaksi wajib diisi."
  })
);

export const transactionItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().positive().optional().nullable(),
  unitPrice: moneySchema.optional().nullable(),
  totalPrice: moneySchema.optional().nullable()
});

export const transactionSchema = z.object({
  receiptId: z.string().optional().nullable(),
  merchant: z.string().trim().max(200).optional().nullable(),
  transactionDate: requiredTransactionDateSchema,
  categoryId: z.string().min(1, "Kategori wajib dipilih."),
  totalAmount: requiredTotalAmountSchema,
  notes: z.string().trim().max(1000).optional().nullable(),
  items: z.array(transactionItemSchema).optional()
});

export const transactionPeriodSchema = z.enum(["month", "year", "all", "custom"]).default("month");

export const transactionFilterSchema = z.object({
  period: transactionPeriodSchema,
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  categoryId: z.string().optional(),
  search: z.string().trim().max(100).optional(),
  needsReview: z.preprocess((value) => value === "1" || value === "true" || value === true, z.boolean().optional())
});
