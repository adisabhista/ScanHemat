import { PageHeader } from "@/components/app/PageHeader";
import { ReceiptUploadForm } from "@/features/receipts/ReceiptUploadForm";
import { getAvailableCategories } from "@/features/categories/queries";
import { requireUserId } from "@/lib/auth";

type ScanPageSearchParams = Promise<{
  error?: string;
}>;

export default async function ScanPage({
  searchParams
}: {
  searchParams: ScanPageSearchParams;
}) {
  const params = await searchParams;
  const userId = await requireUserId();
  const categories = await getAvailableCategories(userId);

  return (
    <>
      <PageHeader title="Pindai Struk" description="Input manual, unggah file, atau pindai struk dengan kamera lalu periksa sebelum menyimpan." />
      {params.error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{params.error}</p> : null}
      <ReceiptUploadForm categories={categories.map((category) => ({ id: category.id, name: category.name }))} />
    </>
  );
}
