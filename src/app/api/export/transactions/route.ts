import { NextResponse } from "next/server";

import { normalizeTransactionFilters, normalizeTransactionPeriod } from "@/features/transactions/period-filter";
import { getTransactionsForExport } from "@/features/transactions/queries";
import { requireUserId } from "@/lib/auth";
import { buildTransactionsCsv } from "@/lib/csv/transactions-export";
import { transactionFilterSchema } from "@/lib/validation/transaction";

export async function GET(request: Request) {
  const userId = await requireUserId();
  const url = new URL(request.url);
  const requestedPeriod = normalizeTransactionPeriod(url.searchParams.get("period") || undefined);
  const parsed = transactionFilterSchema.safeParse({
    period: requestedPeriod,
    month: requestedPeriod === "month" ? url.searchParams.get("month") || undefined : undefined,
    year: requestedPeriod === "month" || requestedPeriod === "year" ? url.searchParams.get("year") || undefined : undefined,
    startDate: requestedPeriod === "custom" ? url.searchParams.get("startDate") || undefined : undefined,
    endDate: requestedPeriod === "custom" ? url.searchParams.get("endDate") || undefined : undefined,
    categoryId: url.searchParams.get("categoryId") || undefined,
    search: url.searchParams.get("search") || undefined,
    needsReview: url.searchParams.get("needsReview") || undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Filter tidak valid." }, { status: 400 });
  }

  const transactions = await getTransactionsForExport(userId, normalizeTransactionFilters(parsed.data));
  const csv = buildTransactionsCsv(transactions);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="scanhemat-transaksi.csv"'
    }
  });
}
