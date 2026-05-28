import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import util from "node:util";

import { createAiGenerationProvider } from "../src/lib/ai/provider-selector";
import { GeminiVisionReceiptVerifier } from "../src/lib/ai/providers/gemini-vision-receipt-verifier";
import type { ParsedReceipt } from "../src/lib/parser/receipt-parser";

const mimeTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf"
};

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("Usage: npm run ai:vision-diagnose -- <path-to-image-or-pdf>");
    process.exit(1);
  }

  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const mimeType = mimeTypes[extname(filePath).toLowerCase()];

  if (!mimeType) {
    console.error("Unsupported file type. Use jpg, jpeg, png, webp, or pdf.");
    process.exit(1);
  }

  const provider = await createAiGenerationProvider();
  const verifier = new GeminiVisionReceiptVerifier(provider);
  const currentExtraction: ParsedReceipt = {
    merchant: undefined,
    transactionDate: undefined,
    totalAmount: undefined,
    items: [],
    warnings: ["Diagnostik visual tanpa hasil ekstraksi awal."],
    confidence: "low"
  };

  console.log("=== Vision AI Diagnostic ===");
  console.log(`- AI_GENERATION_PROVIDER: ${process.env.AI_GENERATION_PROVIDER || "gemini-api"}`);
  console.log(`- Gemini provider selected: ${provider.name}`);
  console.log(`- Model: ${verifier.getModelName()}`);
  console.log(`- GEMINI_API_KEY exists: ${Boolean(process.env.GEMINI_API_KEY?.trim())}`);
  console.log(`- MIME type: ${mimeType}`);

  const result = await verifier.verify({
    imageBuffer: readFileSync(filePath),
    mimeType,
    rawOcrText: "",
    currentExtraction
  });

  console.log("\n--- Vision Result ---");
  console.log(util.inspect(result, { depth: 10, colors: true }));
}

main().catch((error) => {
  console.error("Vision AI diagnostic failed:", error);
  process.exit(1);
});
