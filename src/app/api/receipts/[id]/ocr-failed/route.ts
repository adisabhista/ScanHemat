import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const failureSchema = z.object({
  message: z.string().min(1).max(500)
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const payload = await request.json();
    const parsed = failureSchema.safeParse(payload);
    const message = parsed.success ? parsed.data.message : "Gagal membaca struk. Coba unggah gambar yang lebih jelas.";
    const receipt = await prisma.receipt.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!receipt) {
      return NextResponse.json({ ok: true });
    }

    await prisma.receipt.update({
      where: { id: receipt.id },
      data: {
        status: "OCR_FAILED",
        errorMessage: message
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[OCR] Marking OCR failure failed", error);
    }

    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
