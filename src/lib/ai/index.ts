import { GeminiReceiptExtractor } from "./providers/gemini-receipt-extractor";
import type { AiReceiptExtraction } from "./types";
import {
  classifyReceiptCategory,
  getGeminiCategoryClassification
} from "@/lib/categories/category-classifier";
import { ParsedReceipt } from "@/lib/parser/receipt-parser";

export async function extractReceiptWithAi(rawText: string): Promise<AiReceiptExtraction | null> {
  const provider = process.env.AI_EXTRACTOR_PROVIDER?.trim() || "gemini";
  
  if (provider === "none") {
    return null;
  }

  if (provider === "gemini") {
    const extractor = new GeminiReceiptExtractor();
    return extractor.extract(rawText);
  }

  console.warn(`[AI] Unknown AI extractor provider: ${provider}`);
  return null;
}

function parseIndonesianDateToIso(dateStr: string): string | null {
  // If Gemini outputs 2001-05-26, but the receipt meant 01-05-2026 (DD-MM-YY)
  // We can detect this if the "year" is 2000-2031, and the "day" is > 12.
  const match = dateStr.match(/^20(\d{2})[\/\-](\d{2})[\/\-](\d{2})$/);
  if (match) {
    const yy = parseInt(match[1], 10);
    const mm = match[2];
    const dd = parseInt(match[3], 10);

    // If YY is <= 31 and DD >= 12, it's highly likely they were swapped (since months only go up to 12).
    // Example: 2001-05-26 -> YY=01, DD=26. Real date should be 2026-05-01.
    if (yy <= 31 && dd > 12) {
      return `20${dd}-${mm}-${yy.toString().padStart(2, "0")}`;
    }
  }

  // Handle direct YY-MM-DD output if Gemini ignores YYYY-MM-DD format entirely
  const matchShort = dateStr.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{2})$/);
  if (matchShort) {
    const p1 = parseInt(matchShort[1], 10);
    const p3 = parseInt(matchShort[3], 10);
    
    if (p1 > 12 && p3 <= 31) {
      // DD-MM-YY
      return `20${p3}-${matchShort[2]}-${p1.toString().padStart(2, "0")}`;
    } else if (p1 <= 31 && p3 > 12) {
      // YY-MM-DD
      return `20${p1}-${matchShort[2]}-${p3.toString().padStart(2, "0")}`;
    }
  }

  return null;
}

export function validateAndMergeAiResult(aiResult: AiReceiptExtraction, fallbackResult: ParsedReceipt): ParsedReceipt {
  const warnings: string[] = [...(fallbackResult.warnings ?? []), ...(aiResult.warnings ?? [])];
  let confidence: "high" | "low" = "high";

  // Date Validation
  let transactionDate = aiResult.transactionDate.value ?? undefined;
  if (transactionDate) {
    if (aiResult.transactionDate.confidence < 0.8) {
      warnings.push("Tanggal transaksi kurang yakin. Mohon periksa kembali.");
      confidence = "low";
    }
    // Check if it looks like DD/MM/YY parsed backward by Gemini
    const fixedDate = parseIndonesianDateToIso(transactionDate);
    if (fixedDate) {
      transactionDate = fixedDate;
    }
    // Reject impossible dates
    const year = parseInt(transactionDate.split("-")[0] || "0", 10);
    if (year < 1990 || year > 2100) {
      transactionDate = fallbackResult.transactionDate;
      warnings.push("Tanggal transaksi tidak masuk akal, kembali ke hasil parser biasa.");
    }
  } else {
    transactionDate = fallbackResult.transactionDate;
  }

  // Merchant Validation
  let merchant = aiResult.merchant.value ?? undefined;
  if (!merchant || aiResult.merchant.confidence < 0.6) {
    merchant = fallbackResult.merchant;
    if (merchant) warnings.push("Merchant kurang yakin. Mohon periksa kembali.");
  }

  // Total Validation
  let totalAmount = aiResult.totalAmount.value ?? undefined;
  if (totalAmount !== undefined && totalAmount !== null) {
    if (aiResult.totalAmount.confidence < 0.8) {
      warnings.push("Total transaksi kurang yakin. Mohon periksa kembali.");
      confidence = "low";
    }
    
    // Check if Gemini mistakenly picked a unit price or item total
    const matchesItemPrice = aiResult.items.some(
      (item) => item.unitPrice === totalAmount || item.totalPrice === totalAmount
    );
    const fallbackUsedLargest = (fallbackResult.warnings ?? []).some(w => w.includes("angka terbesar"));
    
    if (matchesItemPrice) {
      warnings.push("AI mungkin salah memilih harga satuan sebagai total.");
      if (fallbackResult.totalAmount !== undefined && !fallbackUsedLargest) {
        totalAmount = fallbackResult.totalAmount; // Override with parser's strong keyword match
      }
      confidence = "low";
    } else if (fallbackResult.totalAmount !== undefined && totalAmount !== fallbackResult.totalAmount && !fallbackUsedLargest) {
      // Conflict between Gemini and parser's strong keyword match
      warnings.push("AI dan sistem parser menemukan total yang berbeda.");
      // Prefer parser if it found a strong keyword consensus, otherwise keep Gemini but warn
      totalAmount = fallbackResult.totalAmount;
      confidence = "low";
    }
    
    // Check total candidates conflicts
    const totalCandidates = aiResult.totalCandidates ?? [];
    const selectedCandidates = totalCandidates.filter(c => c.isSelected);
    if (totalCandidates.length > 1 && selectedCandidates.length > 1) {
       warnings.push("AI menemukan beberapa kandidat total. Mohon pilih yang benar.");
       confidence = "low";
    }
  } else {
    totalAmount = fallbackResult.totalAmount;
  }

  // Category Validation
  const fallbackCategory = classifyReceiptCategory({
    merchant: merchant ?? fallbackResult.merchant,
    items: aiResult.items.length > 0 ? aiResult.items.map((item) => ({ name: item.name })) : fallbackResult.items
  });
  const geminiCategory = aiResult.category ? getGeminiCategoryClassification(aiResult.category) : undefined;
  const selectedCategory = geminiCategory ?? fallbackCategory;

  if (!geminiCategory) {
    warnings.push("Kategori kurang yakin. Mohon periksa kembali.");
  } else if (geminiCategory.confidence < 0.6) {
    warnings.push("Kategori kurang yakin. Mohon periksa kembali.");
    confidence = "low";
  }

  // Deduplicate warnings
  const uniqueWarnings = Array.from(new Set(warnings));

  return {
    merchant: merchant ?? undefined,
    transactionDate: transactionDate ?? undefined,
    totalAmount: totalAmount ?? undefined,
    category: selectedCategory.name,
    categoryConfidence: selectedCategory.confidence,
    categoryReason: selectedCategory.reason,
    categorySource: selectedCategory.source,
    items: aiResult.items.length > 0 ? aiResult.items.map(i => ({
      name: i.name,
      quantity: i.quantity ?? undefined,
      unitPrice: i.unitPrice ?? undefined,
      totalPrice: i.totalPrice ?? undefined
    })) : fallbackResult.items,
    confidence: confidence,
    warnings: uniqueWarnings.length > 0 ? uniqueWarnings : undefined
  };
}
