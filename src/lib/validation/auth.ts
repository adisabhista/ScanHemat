import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi.").max(100),
  email: z.string().trim().email("Email tidak valid.").toLowerCase(),
  password: z.string().min(8, "Kata sandi minimal 8 karakter.")
});

export const loginSchema = z.object({
  email: z.string().trim().email("Email tidak valid.").toLowerCase(),
  password: z.string().min(1, "Kata sandi wajib diisi.")
});
