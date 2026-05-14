import "server-only";

import { createPartFromBase64, GoogleGenAI } from "@google/genai";

import { parseGeminiVisionVerificationText } from "@/lib/ai/providers/gemini-vision-receipt-verifier-parser";
import type { AiReceiptVisionVerification } from "@/lib/ai/types";
import type { ParsedReceipt } from "@/lib/parser/receipt-parser";

type VerifyReceiptInput = {
  imageBuffer: Buffer;
  mimeType: string;
  rawOcrText: string;
  currentExtraction: ParsedReceipt;
};

export function getGeminiVisionModel() {
  return (
    process.env.GEMINI_VISION_MODEL?.trim() ||
    process.env.GEMINI_ASSISTANT_MODEL?.trim() ||
    process.env.GEMINI_RECEIPT_MODEL?.trim()
  );
}

export class GeminiVisionReceiptVerifier {
  private client: GoogleGenAI;
  private model: string;

  constructor() {
    const projectId = process.env.GOOGLE_VERTEX_AI_PROJECT_ID?.trim();
    const location = process.env.GOOGLE_VERTEX_AI_LOCATION?.trim();
    const model = getGeminiVisionModel();

    if (!projectId || !location) {
      throw new Error("Missing Vertex AI configuration: GOOGLE_VERTEX_AI_PROJECT_ID or GOOGLE_VERTEX_AI_LOCATION");
    }

    if (!model) {
      throw new Error("Model Gemini Vision tidak tersedia. Atur GEMINI_VISION_MODEL atau GEMINI_RECEIPT_MODEL.");
    }

    this.client = new GoogleGenAI({
      vertexai: true,
      project: projectId,
      location
    });
    this.model = model;
  }

  getModelName() {
    return this.model;
  }

  async verify(input: VerifyReceiptInput): Promise<AiReceiptVisionVerification> {
    const prompt = buildVisionPrompt(input.rawOcrText, input.currentExtraction);
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [
        { text: prompt },
        createPartFromBase64(input.imageBuffer.toString("base64"), input.mimeType)
      ],
      config: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    });

    if (!response.text) {
      throw new Error("Empty response from Gemini Vision");
    }

    return parseGeminiVisionVerificationText(response.text);
  }
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
