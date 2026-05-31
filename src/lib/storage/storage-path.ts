import path from "path";

export function getSafeReceiptFileName(fileName: string) {
  const baseName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]+/g, "-");
  const normalizedName = baseName.replace(/^\.+/, "").slice(0, 120);

  return normalizedName || "receipt";
}

export function buildReceiptObjectPath(userId: string, receiptId: string, fileName: string) {
  return `receipts/${encodePathSegment(userId)}/${encodePathSegment(receiptId)}/${getSafeReceiptFileName(fileName)}`;
}

export function assertReceiptObjectPath(filePath: string, userId: string) {
  const normalizedPath = path.posix.normalize(filePath);
  const expectedPrefix = `receipts/${encodePathSegment(userId)}/`;

  if (normalizedPath !== filePath || !normalizedPath.startsWith(expectedPrefix) || normalizedPath.includes("..")) {
    throw new Error("Receipt file path is outside the user storage directory.");
  }

  return normalizedPath;
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value).replaceAll("%", "_");
}
