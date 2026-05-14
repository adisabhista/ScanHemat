import { GeminiReceiptExtractor } from "./providers/gemini-receipt-extractor";
import type { AiReceiptExtraction } from "./types";
import {
  classifyReceiptCategory,
  getGeminiCategoryClassification
} from "@/lib/categories/category-classifier";
import { ParsedReceipt } from "@/lib/parser/receipt-parser";
import { parseReceiptDateText, type ReceiptDateDebug } from "@/lib/parser/receipt-date-parser";

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

function normalizeForAiValidation(value: string) {
  return value.toUpperCase().replace(/\s+/g, " ").trim();
}

function isQuantityTotalSource(sourceText: string | null) {
  if (!sourceText) {
    return false;
  }

  const normalized = normalizeForAiValidation(sourceText);

  return normalized.includes("TOTAL KUANTITAS") || normalized.includes("KUANTITAS") || normalized.includes("PRODUK");
}

export function validateAndMergeAiResult(aiResult: AiReceiptExtraction, fallbackResult: ParsedReceipt): ParsedReceipt {
  const warnings: string[] = [...(fallbackResult.warnings ?? []), ...(aiResult.warnings ?? [])];
  let confidence: "high" | "low" = "high";
  const dateDebug: ReceiptDateDebug[] = [...(fallbackResult.dateDebug ?? [])];

  // Date Validation
  let transactionDate = aiResult.transactionDate.value ?? undefined;
  if (transactionDate) {
    if (aiResult.transactionDate.confidence < 0.8) {
      warnings.push("Tanggal transaksi kurang yakin. Mohon periksa kembali.");
      confidence = "low";
    }

    if (aiResult.transactionDate.sourceText) {
      const sourceDate = parseReceiptDateText(aiResult.transactionDate.sourceText);
      dateDebug.push(sourceDate.debug);

      if (sourceDate.isoDate && sourceDate.isoDate !== transactionDate) {
        transactionDate = sourceDate.isoDate;
        warnings.push("Tanggal AI berbeda dari teks struk, memakai tanggal dari teks struk.");
      }
    }

    const parsedAiDate = parseReceiptDateText(transactionDate);
    dateDebug.push(parsedAiDate.debug);

    if (!parsedAiDate.isoDate) {
      transactionDate = fallbackResult.transactionDate;
      warnings.push("Tanggal transaksi tidak masuk akal, kembali ke hasil parser biasa.");
      confidence = "low";
    } else if (parsedAiDate.isoDate !== transactionDate) {
      transactionDate = parsedAiDate.isoDate;
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
  const selectedFallbackTotal = fallbackResult.totalCandidates?.find((candidate) => candidate.isSelected);
  const hasStrongEcommerceTotal = selectedFallbackTotal?.sourceText
    ? normalizeForAiValidation(selectedFallbackTotal.sourceText).includes("TOTAL PEMBAYARAN")
    : false;

  if (totalAmount !== undefined && totalAmount !== null) {
    if (aiResult.totalAmount.confidence < 0.8) {
      warnings.push("Total transaksi kurang yakin. Mohon periksa kembali.");
      confidence = "low";
    }

    if (
      fallbackResult.totalAmount !== undefined &&
      hasStrongEcommerceTotal &&
      (totalAmount !== fallbackResult.totalAmount || isQuantityTotalSource(aiResult.totalAmount.sourceText))
    ) {
      totalAmount = fallbackResult.totalAmount;
      warnings.push("Total AI diganti dengan Total Pembayaran dari struk e-commerce.");
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
    totalCandidates: fallbackResult.totalCandidates,
    fieldConfidences: {
      merchant: aiResult.merchant.confidence,
      transactionDate: aiResult.transactionDate.confidence,
      totalAmount: aiResult.totalAmount.confidence
    },
    category: selectedCategory.name,
    categoryConfidence: selectedCategory.confidence,
    categoryReason: selectedCategory.reason,
    categorySource: selectedCategory.source,
    dateDebug: dateDebug.length > 0 ? dateDebug : undefined,
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
