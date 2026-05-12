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
  transactionDate: z.coerce.date({
    invalid_type_error: "Tanggal transaksi tidak valid."
  }),
  categoryId: z.string().min(1, "Kategori wajib dipilih."),
  totalAmount: requiredTotalAmountSchema,
  notes: z.string().trim().max(1000).optional().nullable(),
  items: z.array(transactionItemSchema).optional()
});

export const transactionFilterSchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  categoryId: z.string().optional()
});
