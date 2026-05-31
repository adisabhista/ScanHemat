import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getReceiptStorage } from "@/lib/storage/storage-provider";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const receipt = await prisma.receipt.findFirst({
      where: { id, userId },
      select: {
        fileName: true,
        filePath: true,
        mimeType: true
      }
    });

    if (!receipt) {
      return NextResponse.json({ error: "Struk tidak ditemukan." }, { status: 404 });
    }

    const content = await getReceiptStorage().readReceipt(receipt.filePath, userId);

    return new NextResponse(new Uint8Array(content).buffer, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${getSafeDownloadName(receipt.fileName)}"`,
        "Content-Type": receipt.mimeType,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Anda perlu masuk untuk melihat struk." }, { status: 401 });
    }

    if (process.env.NODE_ENV === "development") {
      console.error("[Storage] Receipt preview failed", error);
    }

    return NextResponse.json({ error: "Gagal membuka struk. Silakan coba lagi." }, { status: 500 });
  }
}

function getSafeDownloadName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
}
