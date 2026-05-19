import { StatusBadge } from "@/components/ui/StatusBadge";

type TransactionSourceValue = "MANUAL" | "RECEIPT_OCR" | "PDF_OCR";

export function getTransactionSourceLabel(source: TransactionSourceValue) {
  if (source === "MANUAL") {
    return "Manual";
  }

  return "Dari Struk";
}

export function TransactionSourceBadge({ source }: { source: TransactionSourceValue }) {
  const label = getTransactionSourceLabel(source);
  const tone = source === "MANUAL" ? "sky" : "emerald";

  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}
