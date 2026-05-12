import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/PageHeader";
import { getAvailableCategories } from "@/features/categories/queries";
import { TransactionEditForm } from "@/features/transactions/TransactionEditForm";
import { getTransactionById } from "@/features/transactions/queries";
import { requireUserId } from "@/lib/auth";

export default async function TransactionDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const userId = await requireUserId();
  const [transaction, categories] = await Promise.all([
    getTransactionById(userId, params.id),
    getAvailableCategories(userId)
  ]);

  if (!transaction) {
    notFound();
  }

  return (
    <>
      <PageHeader title="Ubah Transaksi" description="Perbarui detail transaksi atau hapus catatan ini." />
      {searchParams.error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</p> : null}
      <TransactionEditForm categories={categories} transaction={transaction} />
    </>
  );
}
