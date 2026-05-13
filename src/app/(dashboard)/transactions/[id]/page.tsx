import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/PageHeader";
import { getAvailableCategories } from "@/features/categories/queries";
import { TransactionEditForm } from "@/features/transactions/TransactionEditForm";
import { getTransactionById } from "@/features/transactions/queries";
import { requireUserId } from "@/lib/auth";

type TransactionDetailPageParams = Promise<{
  id: string;
}>;

type TransactionDetailPageSearchParams = Promise<{
  error?: string;
}>;

export default async function TransactionDetailPage({
  params,
  searchParams
}: {
  params: TransactionDetailPageParams;
  searchParams: TransactionDetailPageSearchParams;
}) {
  const routeParams = await params;
  const queryParams = await searchParams;
  const userId = await requireUserId();
  const [transaction, categories] = await Promise.all([
    getTransactionById(userId, routeParams.id),
    getAvailableCategories(userId)
  ]);

  if (!transaction) {
    notFound();
  }

  return (
    <>
      <PageHeader title="Ubah Transaksi" description="Perbarui detail transaksi atau hapus catatan ini." />
      {queryParams.error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{queryParams.error}</p> : null}
      <TransactionEditForm categories={categories} transaction={transaction} />
    </>
  );
}
