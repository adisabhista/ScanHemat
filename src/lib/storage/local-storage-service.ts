import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import type { StorageService, StoredFile } from "@/lib/storage/storage-service";

const extensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

const uploadRoot = path.join(process.cwd(), "public", "uploads", "receipts");
const publicUploadRoot = "/uploads/receipts";

export class LocalStorageService implements StorageService {
  async saveReceipt(file: File, userId: string): Promise<StoredFile> {
    const extension = extensionByMimeType[file.type] ?? "jpg";
    const fileName = `${randomUUID()}.${extension}`;
    const directory = path.join(uploadRoot, userId);
    const absolutePath = path.join(directory, fileName);

    await mkdir(directory, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absolutePath, buffer);

    const publicPath = path.join(publicUploadRoot, userId, fileName).replaceAll("\\", "/");

    return {
      fileName,
      filePath: publicPath,
      mimeType: file.type,
      fileSize: file.size
    };
  }
}

export const receiptStorage = new LocalStorageService();
