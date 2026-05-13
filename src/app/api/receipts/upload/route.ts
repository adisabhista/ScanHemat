import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/auth";
import { extractReceiptText } from "@/lib/ocr/receipt-ocr-service";
import { parseReceiptText } from "@/lib/parser/receipt-parser";
import { prisma } from "@/lib/prisma";
import { receiptStorage } from "@/lib/storage/local-storage-service";
import { getMaxReceiptUploadBytes, receiptUploadSchema } from "@/lib/validation/receipt";

export const runtime = "nodejs";

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
      const { rawText } = await extractReceiptText({
        content,
        fileName: storedFile.fileName,
        mimeType: storedFile.mimeType
      });
      const parsedReceipt = parseReceiptText(rawText);
      const updatedReceipt = await prisma.receipt.update({
        where: { id: receipt.id },
        data: {
          rawText,
          parsedData: parsedReceipt,
          status: "OCR_COMPLETED",
          errorMessage: null
        }
      });

      return NextResponse.json({
        receiptId: updatedReceipt.id,
        filePath: updatedReceipt.filePath,
        mimeType: updatedReceipt.mimeType,
        rawText: updatedReceipt.rawText ?? "",
        parsed: parsedReceipt
      });
    } catch (ocrError) {
      const message = "Gagal membaca struk. Coba unggah gambar yang lebih jelas.";

      await prisma.receipt.update({
        where: { id: receipt.id },
        data: {
          status: "OCR_FAILED",
          errorMessage: message
        }
      });

      if (process.env.NODE_ENV === "development") {
        console.error("[OCR] Receipt OCR failed", ocrError);
      }

      return NextResponse.json({ error: message, receiptId: receipt.id }, { status: 500 });
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[OCR] Receipt upload failed", error);
    }

    return NextResponse.json({ error: "Gagal mengunggah struk. Silakan coba lagi." }, { status: 500 });
  }
}
