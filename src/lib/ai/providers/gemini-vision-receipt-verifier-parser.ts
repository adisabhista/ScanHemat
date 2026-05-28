import { z } from "zod";

import type { AiReceiptVisionVerification } from "@/lib/ai/types";

const extractedFieldSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    value: valueSchema,
    confidence: z.coerce.number().min(0).max(1),
    sourceText: z.string().nullable(),
    reason: z.string().nullable()
  });

const visionVerificationSchema = z.object({
  merchant: extractedFieldSchema(z.string().nullable()),
  transactionDate: extractedFieldSchema(z.string().nullable()),
  totalAmount: extractedFieldSchema(z.coerce.number().nullable()),
  items: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.coerce.number().nullable(),
        unitPrice: z.coerce.number().nullable(),
        totalPrice: z.coerce.number().nullable(),
        confidence: z.coerce.number().min(0).max(1),
        sourceText: z.string().nullable()
      })
    )
    .default([]),
  warnings: z.array(z.string()).default([]),
  corrections: z
    .array(
      z.object({
        field: z.enum(["merchant", "transactionDate", "totalAmount", "items", "category"]),
        oldValue: z.union([z.string(), z.number(), z.null()]),
        newValue: z.union([z.string(), z.number(), z.null()]),
        reason: z.string(),
        confidence: z.coerce.number().min(0).max(1).nullable().optional(),
        sourceText: z.string().nullable().optional()
      })
    )
    .default([])
});

export function parseGeminiVisionVerificationText(text: string): AiReceiptVisionVerification {
  const jsonText = stripJsonCodeFence(text);
  const parsed = JSON.parse(jsonText) as unknown;

  return visionVerificationSchema.parse(parsed);
}

function stripJsonCodeFence(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}
