import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/auth";
import { suggestReminderFromText } from "@/lib/reminders/gemini";
import { reminderDraftSchema } from "@/lib/validation/reminder";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireUserId();
  } catch {
    return NextResponse.json({ error: "Anda perlu masuk untuk menggunakan Pengingat Cerdas." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = reminderDraftSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Teks pengingat tidak valid." }, { status: 400 });
  }

  const draft = await suggestReminderFromText(parsed.data.text);

  return NextResponse.json({ draft });
}
