import { z } from "zod";

export const budgetSchema = z.object({
  categoryId: z.string().min(1, "Kategori wajib dipilih."),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  amount: z.coerce.number().positive("Nominal harus lebih dari 0.")
});
