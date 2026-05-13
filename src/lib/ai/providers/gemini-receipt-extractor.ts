import { GoogleGenAI } from "@google/genai";
import type { AiReceiptExtraction, AiReceiptExtractor } from "@/lib/ai/types";

export class GeminiReceiptExtractor implements AiReceiptExtractor {
  private client: GoogleGenAI;
  private model: string;

  constructor() {
    const projectId = process.env.GOOGLE_VERTEX_AI_PROJECT_ID?.trim();
    const location = process.env.GOOGLE_VERTEX_AI_LOCATION?.trim();
    const model = process.env.GEMINI_RECEIPT_MODEL?.trim() || "gemini-3-flash-preview";
    
    // We expect GOOGLE_APPLICATION_CREDENTIALS to be set and picked up automatically
    // by the Vertex auth flow, but we MUST pass vertexai configuration.
    if (!projectId || !location) {
      throw new Error("Missing Vertex AI configuration: GOOGLE_VERTEX_AI_PROJECT_ID or GOOGLE_VERTEX_AI_LOCATION");
    }

    this.client = new GoogleGenAI({
      vertexai: true,
      project: projectId,
      location: location
    });
    this.model = model;
  }

  async extract(rawText: string): Promise<AiReceiptExtraction> {
    const prompt = `
Anda adalah ahli sistem parser struk belanja Indonesia. Tugas Anda adalah mengekstrak informasi dari teks mentah (OCR) struk belanja.

ATURAN EKSTRAKSI:
1. Merchant: Pilih nama lengkap toko/perusahaan yang berada di bagian atas. Gabungkan kata jika terpisah (contoh: "PT LION SUPER INDO" bukan hanya "SUPER").
2. Transaction Date: Format wajib YYYY-MM-DD. Perhatikan format DD/MM/YY (01/05/26 = 2026-05-01). Abaikan tanggal dari "Tanggal Pengukuhan", NPWP, Pajak, dll. Jika ragu, berikan confidence rendah.
3. Total Amount: Cari jumlah akhir yang harus dibayar.
   - Kata kunci prioritas: GRAND TOTAL, TOTAL BELANJA, TOTAL BAYAR, JUMLAH BAYAR, PEMBAYARAN, SUB TOTAL.
   - Abaikan: HEMAT, DISKON, KEMBALI, TUNAI (jika itu uang yang diberikan pembeli bukan total), PPN.
   - JANGAN menggunakan nilai terbesar secara buta (misal harga item bisa lebih besar dari total akhir setelah diskon).
   - Jika ada "Sub Total" dan "Pembayaran" dengan nominal yang SAMA, itu kemungkinan besar total akhir.
4. Items: Ekstrak item barang/jasa. Abaikan diskon, pajak, dll.
5. Total Candidates: Tulis semua kandidat angka yang mungkin menjadi total transaksi (misal: subtotal, grand total, uang tunai). Beri alasan kenapa dipilih atau tidak.
6. Category: Pilih TEPAT SATU kategori transaksi dari daftar ini saja:
   - Elektronik
   - Hiburan
   - Kebutuhan Rumah
   - Kesehatan
   - Lainnya
   - Makanan
   - Pendidikan
   - Transportasi
   Jangan buat kategori baru. Jangan pilih "Semua kategori" karena itu hanya opsi filter UI, bukan kategori transaksi.
   Aturan kategori:
   - Supermarket/minimarket/grocery/household stores seperti Super Indo, Indomaret, Alfamart, Alfamidi, Hypermart, Transmart: pilih "Kebutuhan Rumah".
   - Restaurants, cafes, food stalls, beverages, food delivery, KFC, McDonald's, Starbucks: pilih "Makanan".
   - Pharmacy, health store, clinic, hospital, medicine, Guardian, Watsons, Apotek: pilih "Kesehatan".
   - Gas station, parking, toll, ride-hailing, bus, train, transport: pilih "Transportasi".
   - Electronics store, phone accessories, computer parts, gadgets: pilih "Elektronik".
   - Cinema, games, entertainment subscriptions, karaoke, recreation: pilih "Hiburan".
   - School, university, course, books, stationery for education: pilih "Pendidikan".
   - Unknown or unclear: pilih "Lainnya".

KEMBALIKAN HANYA OBJEK JSON (tanpa markdown, tanpa bungkus) dengan skema:
{
  "merchant": { "value": "string|null", "confidence": number, "sourceText": "string|null", "reason": "string|null" },
  "transactionDate": { "value": "YYYY-MM-DD|null", "confidence": number, "sourceText": "string|null", "reason": "string|null" },
  "totalAmount": { "value": number|null, "confidence": number, "sourceText": "string|null", "reason": "string|null" },
  "items": [ { "name": "string", "quantity": number|null, "unitPrice": number|null, "totalPrice": number|null, "confidence": number, "sourceText": "string|null" } ],
  "warnings": [ "string" ],
  "totalCandidates": [ { "amount": number, "sourceText": "string", "reason": "string", "isSelected": boolean } ],
  "category": { "name": "string|null", "confidence": number, "reason": "string|null" }
}

Teks OCR:
${rawText}
`;

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from Gemini");

      // Strip any markdown blocks if the model ignored our request
      const jsonStr = text.replace(/^```json\n?/i, "").replace(/\n?```$/i, "").trim();
      
      try {
        const parsed = JSON.parse(jsonStr) as AiReceiptExtraction;
        return parsed;
      } catch {
        console.error("[AI] Failed to parse JSON from Gemini:", jsonStr);
        throw new Error("Invalid JSON returned from AI model");
      }
    } catch (error: unknown) {
      console.error("[AI] Gemini extraction failed:", error);
      
      if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
        throw new Error("Model Gemini tidak tersedia di Vertex AI. Periksa GEMINI_RECEIPT_MODEL.");
      }
      
      throw error;
    }
  }
}
