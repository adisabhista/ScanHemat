export type AiExtractedField<T> = {
  value: T;
  confidence: number;
  sourceText: string | null;
  reason: string | null;
};

export type AiExtractedItem = {
  name: string;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  confidence: number;
  sourceText: string | null;
};

export type AiTotalCandidate = {
  amount: number;
  sourceText: string;
  reason: string;
  isSelected: boolean;
};

export type AiReceiptExtraction = {
  merchant: AiExtractedField<string | null>;
  transactionDate: AiExtractedField<string | null>;
  totalAmount: AiExtractedField<number | null>;
  items: AiExtractedItem[];
  warnings: string[];
  totalCandidates: AiTotalCandidate[];
  category: { name: string | null; confidence: number; reason: string | null };
};

export interface AiReceiptExtractor {
  extract(rawText: string): Promise<AiReceiptExtraction>;
}
