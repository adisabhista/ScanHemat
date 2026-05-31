import { randomUUID } from "crypto";
import { access, mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

import { assertReceiptObjectPath, buildReceiptObjectPath, getSafeReceiptFileName } from "@/lib/storage/storage-path";
import type { StorageService, StoredFile } from "@/lib/storage/storage-service";

const extensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf"
};

const uploadRoot = path.join(process.cwd(), ".data");
const legacyUploadRoot = path.join(process.cwd(), "public", "uploads", "receipts");
const legacyPublicUploadRoot = "/uploads/receipts";

export class LocalStorageService implements StorageService {
  async saveReceipt(file: File, userId: string, receiptId: string): Promise<StoredFile> {
    const extension = extensionByMimeType[file.type] ?? "jpg";
    const safeOriginalName = getSafeReceiptFileName(file.name || `receipt.${extension}`);
    const fileName = `${randomUUID()}-${safeOriginalName}`;
    const filePath = buildReceiptObjectPath(userId, receiptId, fileName);
    const absolutePath = resolveLocalPath(filePath, userId);

    await mkdir(path.dirname(absolutePath), { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absolutePath, buffer);

    return {
      fileName,
      filePath,
      mimeType: file.type,
      fileSize: file.size
    };
  }

  async readReceipt(filePath: string, userId: string): Promise<Buffer> {
    return readFile(resolveLocalPath(filePath, userId));
  }

  async deleteReceipt(filePath: string, userId: string) {
    await rm(resolveLocalPath(filePath, userId), { force: true });
  }

  async healthCheck() {
    await mkdir(uploadRoot, { recursive: true });
    await access(uploadRoot);
  }
}

function resolveLocalPath(filePath: string, userId: string) {
  if (filePath.startsWith(`${legacyPublicUploadRoot}/${userId}/`)) {
    const fileName = path.posix.basename(path.posix.normalize(filePath));
    return path.join(legacyUploadRoot, userId, fileName);
  }

  const normalizedPath = assertReceiptObjectPath(filePath, userId);
  const absolutePath = path.resolve(uploadRoot, normalizedPath);
  const resolvedRoot = path.resolve(uploadRoot);

  if (!absolutePath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("Receipt file path is outside the storage root.");
  }

  return absolutePath;
}
