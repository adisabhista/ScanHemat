import { extractReceiptWithAi } from "../src/lib/ai/index";
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
  const envKeys = [
    "AI_EXTRACTOR_PROVIDER",
    "GOOGLE_VERTEX_AI_PROJECT_ID",
    "GOOGLE_VERTEX_AI_LOCATION",
    "GEMINI_RECEIPT_MODEL",
    "GOOGLE_APPLICATION_CREDENTIALS"
  ];
  const missingKeys = envKeys.filter(k => !process.env[k]);
  
  if (missingKeys.length > 0) {
    console.error(`Missing required environment variables: ${missingKeys.join(", ")}`);
    process.exit(1);
  }

  console.log(`- Project: ${process.env.GOOGLE_VERTEX_AI_PROJECT_ID}`);
  console.log(`- Location: ${process.env.GOOGLE_VERTEX_AI_LOCATION}`);
  console.log(`- Model: ${process.env.GEMINI_RECEIPT_MODEL}`);
  
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS!;
  console.log(`- Credentials Path: ${credPath}`);
  
  if (!existsSync(credPath)) {
    console.error(`Error: Credential file not found at ${credPath}`);
    process.exit(1);
  } else {
    try {
      const creds = JSON.parse(readFileSync(credPath, "utf-8"));
      console.log(`- Credential Client Email: ${creds.client_email}`);
      console.log(`- Credential Project ID: ${creds.project_id}`);
    } catch {
      console.error("Error: Could not parse credential file as JSON.");
    }
  }

  const rawText = readFileSync(filePath, "utf-8");
  console.log("=== Running Standard Parser ===");
  const standardResult = parseReceiptText(rawText);
  console.log(util.inspect(standardResult, { depth: 4, colors: true }));
  
  console.log("\n=== Running Gemini AI Extractor ===");
  try {
    const aiResult = await extractReceiptWithAi(rawText);
    
    console.log("\n--- AI Result ---");
    console.log(util.inspect(aiResult, { depth: 10, colors: true }));
    
    console.log("\n--- Debug Info ---");
    console.log(`Model: ${process.env.GEMINI_RECEIPT_MODEL || "gemini-3-flash-preview"}`);
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
