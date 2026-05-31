export function getReceiptPreviewUrl(receiptId: string) {
  return `/api/receipts/${encodeURIComponent(receiptId)}/file`;
}
