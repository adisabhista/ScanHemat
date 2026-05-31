import { randomUUID } from "crypto";
import { Storage } from "@google-cloud/storage";

import { assertReceiptObjectPath, buildReceiptObjectPath, getSafeReceiptFileName } from "@/lib/storage/storage-path";
import type { StorageService, StoredFile } from "@/lib/storage/storage-service";

export class GcsStorageService implements StorageService {
  private readonly bucketName: string;
  private readonly storage: Storage;

  constructor(options: { bucketName?: string; storage?: Storage } = {}) {
    this.bucketName = options.bucketName?.trim() || process.env.GCS_RECEIPT_BUCKET?.trim() || "";
    this.storage = options.storage ?? new Storage();

    if (!this.bucketName) {
      throw new Error("GCS_RECEIPT_BUCKET is required when RECEIPT_STORAGE_PROVIDER is gcs.");
    }
  }

  async saveReceipt(file: File, userId: string, receiptId: string): Promise<StoredFile> {
    const safeOriginalName = getSafeReceiptFileName(file.name || "receipt");
    const fileName = `${randomUUID()}-${safeOriginalName}`;
    const filePath = buildReceiptObjectPath(userId, receiptId, fileName);
    const content = Buffer.from(await file.arrayBuffer());

    await this.storage.bucket(this.bucketName).file(filePath).save(content, {
      contentType: file.type,
      resumable: false,
      metadata: {
        cacheControl: "private, max-age=0, no-store"
      }
    });

    return {
      fileName,
      filePath,
      mimeType: file.type,
      fileSize: file.size
    };
  }

  async readReceipt(filePath: string, userId: string) {
    const objectPath = assertReceiptObjectPath(filePath, userId);
    const [content] = await this.storage.bucket(this.bucketName).file(objectPath).download();

    return content;
  }

  async deleteReceipt(filePath: string, userId: string) {
    const objectPath = assertReceiptObjectPath(filePath, userId);
    await this.storage.bucket(this.bucketName).file(objectPath).delete({ ignoreNotFound: true });
  }

  async healthCheck() {
    await this.storage.bucket(this.bucketName).getFiles({ maxResults: 1 });
  }
}
