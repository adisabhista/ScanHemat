import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/auth";
import { parseReceiptText } from "@/lib/parser/receipt-parser";
import { prisma } from "@/lib/prisma";

const ocrResultSchema = z.object({
  rawText: z.string().max(100000)
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const payload = await request.json();
    const parsed = ocrResultSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: "Hasil OCR tidak valid." }, { status: 400 });
    }

    const receipt = await prisma.receipt.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!receipt) {
      return NextResponse.json({ error: "Struk tidak ditemukan." }, { status: 404 });
    }

    const parsedReceipt = parseReceiptText(parsed.data.rawText);
    const updatedReceipt = await prisma.receipt.update({
      where: { id: receipt.id },
      data: {
        rawText: parsed.data.rawText,
        parsedData: parsedReceipt,
        status: "OCR_COMPLETED",
        errorMessage: null
      }
    });

    return NextResponse.json({
      receiptId: updatedReceipt.id,
      filePath: updatedReceipt.filePath,
      rawText: updatedReceipt.rawText ?? "",
      parsed: parsedReceipt
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[OCR] Saving OCR result failed", error);
    }

    return NextResponse.json({ error: "Gagal menyimpan hasil OCR. Silakan coba lagi." }, { status: 500 });
  }
}
