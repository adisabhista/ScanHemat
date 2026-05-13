import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { receiptStorage } from "@/lib/storage/local-storage-service";
import { getMaxReceiptUploadBytes, receiptUploadSchema } from "@/lib/validation/receipt";

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
        status: "UPLOADED"
      }
    });

    return NextResponse.json({
      receiptId: receipt.id,
      filePath: receipt.filePath
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[OCR] Receipt upload failed", error);
    }

    return NextResponse.json({ error: "Gagal mengunggah struk. Silakan coba lagi." }, { status: 500 });
  }
}
