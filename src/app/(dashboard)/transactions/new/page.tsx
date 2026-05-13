import Link from "next/link";

import { PageHeader } from "@/components/app/PageHeader";
import { getAvailableCategories } from "@/features/categories/queries";
import { ManualTransactionForm } from "@/features/transactions/ManualTransactionForm";
import { requireUserId } from "@/lib/auth";
import { SCAN_RECEIPT_ROUTE } from "@/lib/routes";

export default async function NewTransactionPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  const userId = await requireUserId();
  const categories = await getAvailableCategories(userId);

  return (
    <>
      <PageHeader
        title="Tambah Transaksi Manual"
        description="Catat pengeluaran tanpa mengunggah struk."
        action={
          <Link className="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" href={SCAN_RECEIPT_ROUTE}>
            Pindai Struk
          </Link>
        }
      />
      {searchParams.error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</p> : null}
      <ManualTransactionForm categories={categories} />
    </>
  );
}
