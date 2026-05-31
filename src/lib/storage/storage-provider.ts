import { GcsStorageService } from "@/lib/storage/gcs-storage-service";
import { LocalStorageService } from "@/lib/storage/local-storage-service";
import type { StorageService } from "@/lib/storage/storage-service";

export type ReceiptStorageProviderName = "local" | "gcs";
export type ReceiptStorageProviderEnv = {
  NODE_ENV?: string;
  RECEIPT_STORAGE_PROVIDER?: string;
};

let storageService: StorageService | undefined;

export function resolveReceiptStorageProviderName(env: ReceiptStorageProviderEnv = process.env): ReceiptStorageProviderName {
  const configuredProvider = env.RECEIPT_STORAGE_PROVIDER?.trim().toLowerCase();
  const provider = configuredProvider || (env.NODE_ENV === "production" ? "gcs" : "local");

  if (provider !== "local" && provider !== "gcs") {
    throw new Error(`Unsupported RECEIPT_STORAGE_PROVIDER: ${provider}`);
  }

  return provider;
}

export function createReceiptStorageProvider(name = resolveReceiptStorageProviderName()): StorageService {
  return name === "gcs" ? new GcsStorageService() : new LocalStorageService();
}

export function getReceiptStorage() {
  storageService ??= createReceiptStorageProvider();
  return storageService;
}

export function resetReceiptStorageForTests() {
  storageService = undefined;
}
