import { PageHeader } from "@/components/app/PageHeader";
import { ReceiptUploadForm } from "@/features/receipts/ReceiptUploadForm";
import { getAvailableCategories } from "@/features/categories/queries";
import { requireUserId } from "@/lib/auth";

export default async function ScanPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  const userId = await requireUserId();
  const categories = await getAvailableCategories(userId);

  return (
    <>
      <PageHeader title="Pindai Struk" description="Unggah gambar struk, periksa hasil OCR, lalu simpan transaksi." />
      {searchParams.error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</p> : null}
      <ReceiptUploadForm categories={categories.map((category) => ({ id: category.id, name: category.name }))} />
    </>
  );
}
