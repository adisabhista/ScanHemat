export type StoredFile = {
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
};

export interface StorageService {
  saveReceipt(file: File, userId: string, receiptId: string): Promise<StoredFile>;
  readReceipt(filePath: string, userId: string): Promise<Buffer>;
  deleteReceipt(filePath: string, userId: string): Promise<void>;
  healthCheck(): Promise<void>;
}
