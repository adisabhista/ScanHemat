import "server-only";

import { parseGeminiVisionVerificationText } from "@/lib/ai/providers/gemini-vision-receipt-verifier-parser";
import type { AiReceiptVisionVerification } from "@/lib/ai/types";
import type { ParsedReceipt } from "@/lib/parser/receipt-parser";
import { getGeminiModelForRole, type AiGenerationProvider } from "./generation-provider";

type VerifyReceiptInput = {
  imageBuffer: Buffer;
  mimeType: string;
  rawOcrText: string;
  currentExtraction: ParsedReceipt;
};

export function getGeminiVisionModel() {
  return getGeminiModelForRole("vision");
}

export class GeminiVisionReceiptVerifier {
  private model: string;
  private provider: AiGenerationProvider;

  constructor(provider: AiGenerationProvider) {
    this.provider = provider;
    this.model = provider.getModel("vision");
  }

  getModelName() {
    return this.model;
  }

  async verify(input: VerifyReceiptInput): Promise<AiReceiptVisionVerification> {
    const prompt = buildVisionPrompt(input.rawOcrText, input.currentExtraction);
    return this.provider.generateMultimodalJson<AiReceiptVisionVerification>({
      role: "vision",
      model: this.model,
      modelEnvKey: "GEMINI_VISION_MODEL",
      prompt,
      file: {
        content: input.imageBuffer,
        mimeType: input.mimeType
      },
      parse: parseGeminiVisionVerificationTextValue
    });
  }
}

function parseGeminiVisionVerificationTextValue(value: unknown) {
  return parseGeminiVisionVerificationText(JSON.stringify(value));
}

function buildVisionPrompt(rawOcrText: string, currentExtraction: ParsedReceipt) {
  return `
Anda adalah verifikator visual struk Indonesia. Analisis gambar asli struk dan teks OCR, lalu koreksi hanya jika bukti visual jelas.

ATURAN WAJIB:
- Indonesian receipts usually use DD/MM/YY or DD-MM-YY.
- If date is ambiguous like 16/05/26, interpret as DD/MM/YY.
- Do not treat day number 16 as year 2016.
- Ignore dates from Tanggal Pengukuhan, NPWP, NWP, Tax registration, Pajak registration.
- Do not choose unit price as transaction total.
- Do not use largest number heuristic.
- Prefer final total from GRAND TOTAL, TOTAL BELANJA, TOTAL BAYAR, JUMLAH BAYAR, PEMBAYARAN, TOTAL PEMBAYARAN, or SUB TOTAL/SUBTOTAL if no stronger payment total exists.
- For Shopee/e-commerce receipts, final total is usually "Total Pembayaran", seller merchant is "Nama Penjual", do not use "Total Kuantitas" as total, and do not use product subtotal if Total Pembayaran exists.
- Shipping, service fee, discounts, vouchers are not final total.
- Ignore as final transaction total: HEMAT, DISKON, PROMO, POTONGAN, KEMBALI, PPN, PAJAK, ONGKIR, shipping fee, BIAYA LAYANAN, VOUCHER, phone numbers, member numbers, receipt numbers, quantity count.
- If subtotal and payment amount match, that amount is likely final total.
- If there are conflicting totals, return warnings and corrections.
- Indonesian amount rule: dots are usually thousand separators. Rp54.122 means 54122. Rp77.600 means 77600. 175.950 means 175950, not 175.95.

KEMBALIKAN HANYA JSON VALID dengan skema:
{
  "merchant": { "value": "string|null", "confidence": number, "sourceText": "string|null", "reason": "string|null" },
  "transactionDate": { "value": "YYYY-MM-DD|null", "confidence": number, "sourceText": "string|null", "reason": "string|null" },
  "totalAmount": { "value": number|null, "confidence": number, "sourceText": "string|null", "reason": "string|null" },
  "items": [{ "name": "string", "quantity": number|null, "unitPrice": number|null, "totalPrice": number|null, "confidence": number, "sourceText": "string|null" }],
  "warnings": ["string"],
  "corrections": [{ "field": "merchant|transactionDate|totalAmount|items|category", "oldValue": "string|number|null", "newValue": "string|number|null", "reason": "string" }]
}

Hasil ekstraksi saat ini:
${JSON.stringify(currentExtraction, null, 2)}

Teks OCR mentah:
${rawOcrText}
`;
}
