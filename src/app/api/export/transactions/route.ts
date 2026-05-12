import { NextResponse } from "next/server";

import { getTransactions } from "@/features/transactions/queries";
import { requireUserId } from "@/lib/auth";
import { buildTransactionsCsv } from "@/lib/csv/transactions-export";
import { transactionFilterSchema } from "@/lib/validation/transaction";

export async function GET(request: Request) {
  const userId = await requireUserId();
  const url = new URL(request.url);
  const parsed = transactionFilterSchema.safeParse({
    month: url.searchParams.get("month") || undefined,
    year: url.searchParams.get("year") || undefined,
    categoryId: url.searchParams.get("categoryId") || undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Filter tidak valid." }, { status: 400 });
  }

  const transactions = await getTransactions(userId, parsed.data);
  const csv = buildTransactionsCsv(transactions);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="scanhemat-transaksi.csv"'
    }
  });
}
