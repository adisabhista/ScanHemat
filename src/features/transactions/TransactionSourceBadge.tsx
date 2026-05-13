type TransactionSourceValue = "MANUAL" | "RECEIPT_OCR" | "PDF_OCR";

export function getTransactionSourceLabel(source: TransactionSourceValue) {
  if (source === "MANUAL") {
    return "Input Manual";
  }

  return "Dari Struk";
}

export function TransactionSourceBadge({ source }: { source: TransactionSourceValue }) {
  const label = getTransactionSourceLabel(source);
  const tone =
    source === "MANUAL"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}
