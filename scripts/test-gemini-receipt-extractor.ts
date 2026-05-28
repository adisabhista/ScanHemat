import { createAiGenerationProvider, resolveAiGenerationProviderName } from "../src/lib/ai/provider-selector";
import { GeminiReceiptExtractor } from "../src/lib/ai/providers/gemini-receipt-extractor";
import { DEFAULT_GEMINI_PRIMARY_MODEL, getGeminiFallbackModel } from "../src/lib/ai/providers/generation-provider";
import { parseReceiptText } from "../src/lib/parser/receipt-parser";
import { readFileSync, existsSync } from "node:fs";
import util from "node:util";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npm run ai:diagnose -- <path-to-raw-text-file>");
    process.exit(1);
  }

  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const ext = filePath.toLowerCase().split('.').pop();
  if (['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
    console.error(`\nError: ai:diagnose expects raw OCR text.`);
    console.error(`Use ocr:diagnose for PDF/image files or provide a .txt file.`);
    console.error(`Example: npm run ai:diagnose -- "E:\\Document\\PersonalFinance\\sample-ocr.txt"\n`);
    process.exit(1);
  }

  console.log("=== Environment Validation ===");
  const provider = resolveAiGenerationProviderName();
  const primaryModel = process.env.GEMINI_RECEIPT_MODEL?.trim() || DEFAULT_GEMINI_PRIMARY_MODEL;
  const fallbackModel = getGeminiFallbackModel();
  const envKeys =
    provider === "vertex-ai"
      ? ["GOOGLE_VERTEX_AI_PROJECT_ID", "GOOGLE_VERTEX_AI_LOCATION"]
      : ["GEMINI_API_KEY"];
  const missingKeys = envKeys.filter(k => !process.env[k]);
  
  if (missingKeys.length > 0) {
    console.error(`Missing required environment variables: ${missingKeys.join(", ")}`);
    process.exit(1);
  }

  console.log(`- AI_GENERATION_PROVIDER: ${process.env.AI_GENERATION_PROVIDER || "gemini-api"}`);
  console.log(`- Gemini provider selected: ${provider}`);
  console.log(`- Primary model: ${primaryModel}`);
  console.log(`- Fallback model: ${fallbackModel}`);
  console.log(`- GEMINI_API_KEY exists: ${Boolean(process.env.GEMINI_API_KEY?.trim())}`);

  if (provider === "vertex-ai") {
    console.log(`- Vertex Project: ${process.env.GOOGLE_VERTEX_AI_PROJECT_ID}`);
    console.log(`- Vertex Location: ${process.env.GOOGLE_VERTEX_AI_LOCATION}`);
  }

  const rawText = readFileSync(filePath, "utf-8");
  console.log("=== Running Standard Parser ===");
  const standardResult = parseReceiptText(rawText);
  console.log(util.inspect(standardResult, { depth: 4, colors: true }));
  
  console.log("\n=== Running Gemini AI Extractor ===");
  try {
    const generationProvider = await createAiGenerationProvider();
    const extractor = new GeminiReceiptExtractor(generationProvider);
    const aiResult = await extractor.extract(rawText);
    const providerDebug = generationProvider.getLastCallDebug?.();
    
    console.log("\n--- AI Result ---");
    console.log(util.inspect(aiResult, { depth: 10, colors: true }));
    
    console.log("\n--- Debug Info ---");
    console.log(`Provider: ${provider}`);
    console.log(`Primary model: ${providerDebug?.primaryModel ?? primaryModel}`);
    console.log(`Fallback model: ${providerDebug?.fallbackModel ?? fallbackModel}`);
    console.log(`Fallback used: ${providerDebug?.fallbackUsed ?? false}`);
    console.log(`Merchant Source: ${aiResult?.merchant.sourceText}`);
    console.log(`Date Source: ${aiResult?.transactionDate.sourceText}`);
    console.log(`Total Source: ${aiResult?.totalAmount.sourceText}`);
    
    if (aiResult?.totalCandidates) {
      console.log("\n--- Total Candidates ---");
      for (const c of aiResult.totalCandidates) {
        console.log(`[${c.isSelected ? 'X' : ' '}] ${c.amount} (${c.sourceText}) -> ${c.reason}`);
      }
    }
  } catch (err) {
    console.error("AI Extraction failed:", err);
  }
}

main().catch(console.error);
