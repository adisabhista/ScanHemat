import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/auth";
import { createAiGenerationProvider } from "@/lib/ai/provider-selector";
import { GeminiVisionReceiptVerifier } from "@/lib/ai/providers/gemini-vision-receipt-verifier";
import { getAiGenerationUserMessage } from "@/lib/ai/providers/generation-provider";
import { mergeVisionVerificationResult } from "@/lib/ai/vision-verification";
import { generateReceiptAudit } from "@/lib/audit/receipt-audit";
import type { ParsedReceipt } from "@/lib/parser/receipt-parser";
import { prisma } from "@/lib/prisma";
import { getReceiptReviewState } from "@/lib/review/review-state";
import { receiptStorage } from "@/lib/storage/local-storage-service";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let requestedMimeType: string | undefined;

  try {
    const userId = await requireUserId();
    const { id } = await params;
    const receipt = await prisma.receipt.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!receipt) {
      return NextResponse.json({ error: "Struk tidak ditemukan." }, { status: 404 });
    }
    requestedMimeType = receipt.mimeType;

    if (!receipt.rawText || !receipt.parsedData) {
      return NextResponse.json({ error: "Hasil OCR belum tersedia untuk struk ini." }, { status: 400 });
    }

    if (!receipt.mimeType.startsWith("image/") && receipt.mimeType !== "application/pdf") {
      return NextResponse.json({ error: "Analisis AI Visual tidak tersedia untuk format struk ini." }, { status: 400 });
    }

    const currentExtraction = receipt.parsedData as ParsedReceipt;
    const imageBuffer = await receiptStorage.readReceipt(receipt.filePath, userId);
    const generationProvider = await createAiGenerationProvider();
    const verifier = new GeminiVisionReceiptVerifier(generationProvider);

    if (process.env.NODE_ENV === "development") {
      console.debug("[Vision] vision verifier triggered", { receiptId: receipt.id, mimeType: receipt.mimeType });
      console.debug("[Vision] Gemini Vision model", { model: verifier.getModelName() });
    }

    const verification = await verifier.verify({
      imageBuffer,
      mimeType: receipt.mimeType,
      rawOcrText: receipt.rawText,
      currentExtraction
    });
    const mergedReceipt = mergeVisionVerificationResult(currentExtraction, verification);
    mergedReceipt.audit = generateReceiptAudit({ rawText: receipt.rawText, parsedReceipt: mergedReceipt });
    const reviewState = getReceiptReviewState(mergedReceipt);

    const updatedReceipt = await prisma.receipt.update({
      where: { id: receipt.id },
      data: {
        parsedData: mergedReceipt,
        errorMessage: null,
        needsReview: reviewState.needsReview,
        reviewReasons: reviewState.reasons,
        reviewedAt: null
      }
    });

    if (process.env.NODE_ENV === "development") {
      console.debug("[Vision] Gemini Vision completed", {
        receiptId: receipt.id,
        corrections: verification.corrections.length,
        confidenceValues: mergedReceipt.fieldConfidences
      });
      console.debug("[Vision] corrections returned", verification.corrections);
    }

    return NextResponse.json({
      receiptId: updatedReceipt.id,
      filePath: updatedReceipt.filePath,
      mimeType: updatedReceipt.mimeType,
      parsed: mergedReceipt,
      corrections: verification.corrections
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[Vision] Gemini Vision failed", error);
    }

    const message = getAiGenerationUserMessage(
      error,
      requestedMimeType === "application/pdf"
        ? "Analisis AI Visual tidak tersedia untuk PDF ini. Mohon periksa hasil secara manual."
        : "Analisis AI Visual gagal. Mohon periksa hasil secara manual."
    );

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
