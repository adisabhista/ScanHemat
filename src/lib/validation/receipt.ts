import { z } from "zod";

export const allowedReceiptMimeTypes = ["image/jpeg", "image/png", "image/webp"];

export const receiptUploadSchema = z.object({
  file: z
    .instanceof(File, { message: "Struk wajib diunggah." })
    .refine((file) => file.size > 0, "Struk wajib diunggah.")
    .refine(
      (file) => allowedReceiptMimeTypes.includes(file.type),
      "Format gambar harus JPG, PNG, atau WebP."
    )
});

export function getMaxReceiptUploadBytes() {
  const sizeMb = Number(process.env.MAX_RECEIPT_UPLOAD_MB ?? "8");
  return sizeMb * 1024 * 1024;
}
