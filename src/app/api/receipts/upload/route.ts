import { NextResponse } from "next/server";

import { getAvailableCategories } from "@/features/categories/queries";
import { requireUserId } from "@/lib/auth";
import { extractReceiptWithAi, validateAndMergeAiResult } from "@/lib/ai/index";
import { generateReceiptAudit } from "@/lib/audit/receipt-audit";
import {
  findCategoryOptionByName,
  getDefaultCategoryOption,
  normalizeTransactionCategoryName
} from "@/lib/categories/category-classifier";
import { extractReceiptText, OcrProcessingError } from "@/lib/ocr";
import { serializeError } from "@/lib/ocr/serialize-error";
import { parseReceiptText } from "@/lib/parser/receipt-parser";
import { prisma } from "@/lib/prisma";
import { receiptStorage } from "@/lib/storage/local-storage-service";
import { getMaxReceiptUploadBytes, receiptUploadSchema } from "@/lib/validation/receipt";

export const runtime = "nodejs";

function getDevelopmentOcrDebug(error: unknown) {
  if (process.env.NODE_ENV !== "development") {
    return undefined;
  }

  // When the error is an OcrProcessingError with a populated debug field, use it directly.
  // Otherwise, fall back to serializeError to ensure we never return {} to the frontend.
  if (error instanceof OcrProcessingError && error.debug) {
    return {
      provider: error.debug.provider ?? "google-document-ai",
      code: error.debug.code ?? error.code,
      message: error.debug.message ?? error.message,
      missingEnvKeys: error.debug.missingEnvKeys ?? (error.details?.missingEnvKeys as string[] | undefined),
      presentEnvKeys: error.debug.presentEnvKeys,
      errorName: error.debug.errorName,
      googleCode: error.debug.googleCode,
      googleDetails: error.debug.googleDetails,
      googleReason: error.debug.googleReason,
      googleMetadata: error.debug.googleMetadata,
      credentialFilePresent: error.debug.credentialFilePresent,
      credentialFileReadable: error.debug.credentialFileReadable,
      credentialClientEmail: error.debug.credentialClientEmail,
      credentialProjectId: error.debug.credentialProjectId,
      credentialType: error.debug.credentialType,
      credentialError: error.debug.credentialError,
      configuredProjectId: error.debug.configuredProjectId,
      projectMismatch: error.debug.projectMismatch,
      processorName: error.debug.processorName,
      deepError: error.debug.deepError
    };
  }

  // Fallback: serialize the raw error so the frontend always gets useful data
  const serialized = serializeError(error);

  return {
    provider: "unknown",
    code: error instanceof OcrProcessingError ? error.code : serialized.code,
    message: serialized.message,
    errorName: serialized.name,
    reason: serialized.reason
  };
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const formData = await request.formData();
    const file = formData.get("file");
    const parsedFile = receiptUploadSchema.safeParse({ file });

    if (!parsedFile.success) {
      return NextResponse.json({ error: parsedFile.error.errors[0]?.message ?? "Struk tidak valid." }, { status: 400 });
    }

    if (parsedFile.data.file.size > getMaxReceiptUploadBytes()) {
      return NextResponse.json({ error: "Ukuran file terlalu besar." }, { status: 400 });
    }

    const storedFile = await receiptStorage.saveReceipt(parsedFile.data.file, userId);
    const receipt = await prisma.receipt.create({
      data: {
        userId,
        ...storedFile,
        status: "OCR_PROCESSING"
      }
    });

    try {
      const content = await receiptStorage.readReceipt(storedFile.filePath, userId);
      const ocrResult = await extractReceiptText({
        content,
        fileName: storedFile.fileName,
        mimeType: storedFile.mimeType
      });
      const { rawText } = ocrResult;
      const parsedReceipt = parseReceiptText(rawText);
      let finalReceipt = parsedReceipt;
      let aiResultDebug = null;

      try {
        const aiResult = await extractReceiptWithAi(rawText);
        if (aiResult) {
          aiResultDebug = aiResult;
          finalReceipt = validateAndMergeAiResult(aiResult, parsedReceipt);
        }
      } catch (err) {
        console.warn("[AI] Extractor failed, falling back to standard parser:", err);
        const warnMsg = err instanceof Error && err.message.includes("Model Gemini tidak tersedia")
          ? err.message
          : "Ekstraksi AI gagal. Hasil diambil dari OCR biasa dan perlu diperiksa.";
        finalReceipt.warnings = [...(finalReceipt.warnings ?? []), warnMsg];
        finalReceipt.confidence = "low";
      }

      if (process.env.NODE_ENV === "development" && aiResultDebug) {
        console.debug("[AI] Gemini extraction completed. Final Source Map:", {
          model: process.env.GEMINI_RECEIPT_MODEL,
          merchantSource: finalReceipt.merchant === aiResultDebug.merchant.value ? "gemini" : "parser",
          dateSource: finalReceipt.transactionDate === aiResultDebug.transactionDate.value ? "gemini" : (finalReceipt.transactionDate ? "parser" : "fallback"),
          rawDateText: aiResultDebug.transactionDate.sourceText,
          selectedDate: finalReceipt.transactionDate,
          dateDebug: finalReceipt.dateDebug,
          totalSource: finalReceipt.totalAmount === aiResultDebug.totalAmount.value ? "gemini" : (finalReceipt.totalAmount === parsedReceipt.totalAmount ? "parser" : "fallback"),
          categorySource: finalReceipt.categorySource,
          selectedCategory: finalReceipt.category,
          categoryConfidence: finalReceipt.categoryConfidence,
          categoryReason: finalReceipt.categoryReason,
          selectedTotalSourceText: finalReceipt.totalAmount === aiResultDebug.totalAmount.value ? aiResultDebug.totalAmount.sourceText : "parser-fallback",
          selectedTotalReason: finalReceipt.totalAmount === aiResultDebug.totalAmount.value ? aiResultDebug.totalAmount.reason : "validator override",
          totalCandidates: finalReceipt.totalCandidates,
          rejectedTotalCandidates: (aiResultDebug.totalCandidates ?? []).filter(c => c.amount !== finalReceipt.totalAmount).map(c => ({ amount: c.amount, reason: c.reason })),
          warnings: finalReceipt.warnings
        });
      }

      const availableCategories = await getAvailableCategories(userId);
      const matchedCategory = findCategoryOptionByName(availableCategories, finalReceipt.category);
      const defaultCategory = getDefaultCategoryOption(availableCategories);
      const selectedCategory = matchedCategory ?? defaultCategory;
      const requestedCategory = finalReceipt.category;
      const normalizedSelectedCategory = selectedCategory ? normalizeTransactionCategoryName(selectedCategory.name) : undefined;

      if (selectedCategory && normalizedSelectedCategory) {
        finalReceipt.categoryId = selectedCategory.id;
        finalReceipt.category = normalizedSelectedCategory;
      }

      if (!matchedCategory && defaultCategory) {
        finalReceipt.categorySource = "default";
        finalReceipt.categoryConfidence = finalReceipt.categoryConfidence ?? 0.4;
        finalReceipt.categoryReason = `Kategori "${requestedCategory ?? "-"}" tidak tersedia, memakai Lainnya.`;
      }

      if (process.env.NODE_ENV === "development") {
        console.debug("[AI] Date parsing", {
          selectedDate: finalReceipt.transactionDate,
          dateDebug: finalReceipt.dateDebug
        });

        console.debug("[AI] Category classification", {
          categorySource: finalReceipt.categorySource,
          selectedCategory: finalReceipt.category,
          selectedCategoryId: finalReceipt.categoryId,
          confidence: finalReceipt.categoryConfidence,
          reason: finalReceipt.categoryReason
        });
      }

      finalReceipt.audit = generateReceiptAudit({ rawText, parsedReceipt: finalReceipt });

      const updatedReceipt = await prisma.receipt.update({
        where: { id: receipt.id },
        data: {
          rawText,
          parsedData: finalReceipt,
          status: "OCR_COMPLETED",
          errorMessage: null
        }
      });

      return NextResponse.json({
        receiptId: updatedReceipt.id,
        filePath: updatedReceipt.filePath,
        mimeType: updatedReceipt.mimeType,
        rawText: updatedReceipt.rawText ?? "",
        parsed: finalReceipt,
        ocr: {
          provider: ocrResult.provider,
          confidence: ocrResult.confidence,
          pages: ocrResult.pages
        }
      });
    } catch (ocrError) {
      const message =
        ocrError instanceof OcrProcessingError ? ocrError.userMessage : "Gagal membaca struk dengan Google OCR.";
      const status = ocrError instanceof OcrProcessingError ? ocrError.statusCode : 500;

      await prisma.receipt.update({
        where: { id: receipt.id },
        data: {
          status: "OCR_FAILED",
          errorMessage: message
        }
      });

      if (process.env.NODE_ENV === "development") {
        const debug = getDevelopmentOcrDebug(ocrError);

        console.error("[OCR] Receipt OCR failed", {
          receiptId: receipt.id,
          fileName: storedFile.fileName,
          mimeType: storedFile.mimeType,
          debug
        });
      }

      return NextResponse.json(
        {
          error: message,
          receiptId: receipt.id,
          debug: getDevelopmentOcrDebug(ocrError)
        },
        { status }
      );
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[OCR] Receipt upload failed", error);
    }

    return NextResponse.json({ error: "Gagal mengunggah struk. Silakan coba lagi." }, { status: 500 });
  }
}
