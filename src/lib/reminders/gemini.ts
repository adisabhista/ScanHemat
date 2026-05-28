import { ReminderType, RepeatType } from "@prisma/client";
import { z } from "zod";

import { createAiGenerationProvider } from "@/lib/ai/provider-selector";

const draftSchema = z.object({
  title: z.string().trim().min(1).max(200),
  type: z.nativeEnum(ReminderType),
  amount: z.number().int().positive().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  repeatType: z.nativeEnum(RepeatType),
  notes: z.string().trim().max(1000).nullable(),
  relatedMerchant: z.string().trim().max(200).nullable(),
  relatedDocumentName: z.string().trim().max(200).nullable()
});

export type ReminderDraft = z.infer<typeof draftSchema>;

const monthNames: Record<string, number> = {
  januari: 1,
  jan: 1,
  februari: 2,
  feb: 2,
  maret: 3,
  mar: 3,
  april: 4,
  apr: 4,
  mei: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  agustus: 8,
  agu: 8,
  ags: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  desember: 12,
  des: 12
};

const fullMonthNames = [
  "",
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember"
];

const knownMerchants = [
  { pattern: /\byoutube\s+premium\b/i, name: "YouTube Premium" },
  { pattern: /\bfirst\s+media\b/i, name: "First Media" },
  { pattern: /\bgoogle\s+one\b/i, name: "Google One" },
  { pattern: /\bindihome\b/i, name: "IndiHome" },
  { pattern: /\bspotify\b/i, name: "Spotify" },
  { pattern: /\bnetflix\b/i, name: "Netflix" },
  { pattern: /\bicloud\b/i, name: "iCloud" },
  { pattern: /\bcanva\b/i, name: "Canva" },
  { pattern: /\bbiznet\b/i, name: "Biznet" },
  { pattern: /\btelkomsel\b/i, name: "Telkomsel" },
  { pattern: /\bpln\b/i, name: "PLN" },
  { pattern: /\bpdam\b/i, name: "PDAM" },
  { pattern: /\bxl\b/i, name: "XL" }
] as const;

const knownBanks = [
  { pattern: /\bbca\b/i, name: "BCA" },
  { pattern: /\bbri\b/i, name: "BRI" },
  { pattern: /\bbni\b/i, name: "BNI" },
  { pattern: /\bmandiri\b/i, name: "Mandiri" },
  { pattern: /\bcimb\b/i, name: "CIMB Niaga" },
  { pattern: /\bjago\b/i, name: "Bank Jago" },
  { pattern: /\bseabank\b/i, name: "SeaBank" },
  { pattern: /\bblu\b/i, name: "blu by BCA Digital" }
] as const;

const monthNamePattern = "januari|jan|februari|feb|maret|mar|april|apr|mei|juni|jun|juli|jul|agustus|agu|ags|september|sep|sept|oktober|okt|november|nov|desember|des";

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function capitalizeMonthName(month: string) {
  const normalized = month.toLowerCase();
  const fullMonth = fullMonthNames[monthNames[normalized]] ?? normalized;

  return fullMonth.charAt(0).toUpperCase() + fullMonth.slice(1);
}

function hasExplicitMoneyCue(text: string) {
  return /\b(biaya|harga|sebesar|senilai|ribu|rb|juta)\b|(?:^|\s)rp\s*/i.test(text);
}

function hasPaymentContext(text: string) {
  return /\b(bayar|pembayaran|tagihan|langganan)\b/i.test(text);
}

function parseAmount(text: string) {
  const normalized = text.toLowerCase();

  if (!hasExplicitMoneyCue(normalized) && !hasPaymentContext(normalized)) {
    return null;
  }

  const millionMatch = normalized.match(/(?:rp\s*)?(\d+(?:[,.]\d+)?)\s*juta\b/i);

  if (millionMatch?.[1]) {
    return Math.round(Number(millionMatch[1].replace(",", ".")) * 1_000_000);
  }

  const thousandMatch = normalized.match(/(?:rp\s*)?(\d+(?:[,.]\d+)?)\s*(?:ribu|rb)\b/i);

  if (thousandMatch?.[1]) {
    return Math.round(Number(thousandMatch[1].replace(",", ".")) * 1000);
  }

  const cuedAmountMatch = normalized.match(/(?:dengan\s+biaya|biaya|harga|sebesar|senilai|rp)\s*\.?\s*(\d{1,3}(?:[.,]\d{3})+|\d{4,})/i);
  const contextualAmountMatch = hasPaymentContext(normalized) ? normalized.match(/\b(\d{1,3}(?:[.,]\d{3})+)\b/) : null;
  const rupiahMatch = cuedAmountMatch ?? contextualAmountMatch;

  if (!rupiahMatch?.[1]) {
    return null;
  }

  const amount = Number(rupiahMatch[1].replace(/[.,]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function toIsoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function getLastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toMonthEndIsoDate(year: number, month: number) {
  return toIsoDate(year, month, getLastDayOfMonth(year, month));
}

function nextMonthlyDate(day: number, now: Date) {
  if (day < 1 || day > 31) {
    return null;
  }

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const currentIso = toIsoDate(now.getUTCFullYear(), now.getUTCMonth() + 1, day);
  const current = currentIso ? new Date(`${currentIso}T00:00:00.000Z`) : null;

  if (current && current >= today) {
    return currentIso;
  }

  return toIsoDate(now.getUTCFullYear(), now.getUTCMonth() + 2, day);
}

function hasExpirationContext(text: string) {
  return /\b(valid\s+thru(?:\s+nya)?|valid\s+sampai|berlaku\s+sampai|masa\s+berlaku\s+sampai|expired|kadaluarsa|kedaluwarsa|habis\s+masa\s+berlaku|sampai\s+bulan)\b/i.test(text);
}

function getExpirationLabel(text: string) {
  const normalized = text.toLowerCase();

  if (/valid\s+thru/i.test(text)) {
    return "Valid thru";
  }

  if (/\bvalid\s+sampai\b/i.test(text)) {
    return "Valid sampai";
  }

  if (/\bberlaku\s+sampai|\bmasa\s+berlaku\s+sampai/i.test(text)) {
    return "Berlaku sampai";
  }

  if (/\bexpired|kadaluarsa|kedaluwarsa|habis\s+masa\s+berlaku\b/.test(normalized)) {
    return "Habis masa berlaku";
  }

  return "Berlaku sampai";
}

function parseDueDay(text: string) {
  const normalized = text.toLowerCase();
  const tanggalMatch = normalized.match(/(?:setiap\s+jatuh\s+tempo\s+tanggal|jatuh\s+tempo\s+tanggal|setiap\s+tanggal|tiap\s+tanggal|tanggal|tgl)\s+(\d{1,2})\b/);

  if (tanggalMatch?.[1]) {
    const day = Number(tanggalMatch[1]);
    return day >= 1 && day <= 31 ? day : null;
  }

  return null;
}

function parseDueDateParts(text: string, now: Date) {
  const normalized = text.toLowerCase();
  const monthMatch = normalized.match(new RegExp(`\\b(\\d{1,2})\\s+(${monthNamePattern})\\s+(\\d{4})\\b`));

  if (monthMatch?.[1] && monthMatch[2] && monthMatch[3]) {
    const dueDate = toIsoDate(Number(monthMatch[3]), monthNames[monthMatch[2]], Number(monthMatch[1]));
    return { dueDate, dueDay: null, dueDateReason: "explicit-day-month-year" };
  }

  const monthYearMatch = normalized.match(new RegExp(`(?:\\bbulan\\s+)?\\b(${monthNamePattern})\\s+(\\d{4})\\b`));

  if (monthYearMatch?.[1] && monthYearMatch[2] && (hasExpirationContext(text) || /\bgaransi\b/i.test(text))) {
    const month = monthNames[monthYearMatch[1]];
    const year = Number(monthYearMatch[2]);
    return {
      dueDate: toMonthEndIsoDate(year, month),
      dueDay: null,
      dueDateReason: `month-year-expiration:${capitalizeMonthName(monthYearMatch[1])} ${year}`
    };
  }

  const dueDay = parseDueDay(text);

  if (dueDay) {
    return { dueDate: nextMonthlyDate(dueDay, now), dueDay, dueDateReason: "monthly-due-day" };
  }

  const isoMatch = normalized.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);

  if (isoMatch?.[1] && isoMatch[2] && isoMatch[3]) {
    const dueDate = toIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    return { dueDate, dueDay: null, dueDateReason: "iso-date" };
  }

  return { dueDate: null, dueDay: null, dueDateReason: null };
}

function isCardDocument(text: string) {
  return /\b(kartu\s+debit|kartu\s+kredit|atm|debit\s+bca|kartu\s+bca|valid\s+thru)\b/i.test(text);
}

function inferType(text: string): ReminderType {
  const normalized = text.toLowerCase();

  if (/\b(langganan)\b/.test(normalized)) return ReminderType.SUBSCRIPTION;
  if (/\b(tagihan)\b/.test(normalized)) return ReminderType.BILL;
  if (/\b(stnk)\b/.test(normalized)) return ReminderType.STNK;
  if (/\b(sim)\b/.test(normalized)) return ReminderType.SIM;
  if (/\b(garansi)\b/.test(normalized)) return ReminderType.WARRANTY;
  if (isCardDocument(text) || hasExpirationContext(text)) return ReminderType.DOCUMENT;
  if (/\b(pajak|kendaraan|motor|mobil)\b/.test(normalized)) return ReminderType.VEHICLE_TAX;
  if (/\b(domain|lisensi|license|software)\b/.test(normalized)) return ReminderType.LICENSE;
  if (/\b(dokumen|paspor|sertifikat)\b/.test(normalized)) return ReminderType.DOCUMENT;
  if (/\b(langganan|premium|youtube|netflix|spotify|google one|icloud)\b/.test(normalized)) return ReminderType.SUBSCRIPTION;
  if (/\b(tagihan|internet|listrik|air|pdam)\b/.test(normalized)) return ReminderType.BILL;

  return ReminderType.OTHER;
}

function inferRepeatType(text: string, type: ReminderType): RepeatType {
  const normalized = text.toLowerCase();

  if (type === ReminderType.DOCUMENT || type === ReminderType.SIM || type === ReminderType.WARRANTY) return RepeatType.NONE;
  if (/\b(mingguan|tiap minggu|setiap minggu)\b/.test(normalized)) return RepeatType.WEEKLY;
  if (/\b(setiap tanggal|tiap tanggal|setiap jatuh tempo tanggal|bulanan|tiap bulan|setiap bulan|per bulan|\/bulan)\b/.test(normalized)) return RepeatType.MONTHLY;
  if (/\b(tahunan|tiap tahun|setiap tahun|per tahun|\/tahun)\b/.test(normalized)) return RepeatType.YEARLY;
  if (type === ReminderType.SUBSCRIPTION || type === ReminderType.BILL) return RepeatType.MONTHLY;
  if (type === ReminderType.STNK || type === ReminderType.VEHICLE_TAX || type === ReminderType.LICENSE) return RepeatType.YEARLY;

  return RepeatType.NONE;
}

function extractKnownMerchant(text: string) {
  const bankMatch = knownBanks.find((bank) => bank.pattern.test(text));

  if (bankMatch) {
    return bankMatch.name;
  }

  const match = knownMerchants.find((merchant) => merchant.pattern.test(text));

  return match?.name ?? null;
}

function getCardKind(text: string) {
  if (/\bkartu\s+kredit\b/i.test(text)) {
    return "kartu kredit";
  }

  if (/\bkartu\s+debit\b|\bdebit\b/i.test(text)) {
    return "kartu debit";
  }

  if (/\batm\b/i.test(text)) {
    return "ATM";
  }

  if (/\bkartu\b/i.test(text)) {
    return "kartu";
  }

  return null;
}

function hasInternetContext(text: string) {
  return /\binternet\b/i.test(text);
}

function inferTitle(text: string, type: ReminderType, merchant: string | null) {
  if (type === ReminderType.DOCUMENT && merchant) {
    const cardKind = getCardKind(text);

    if (cardKind) {
      const prefix = /\bganti\b/i.test(text) ? "Ganti " : "";
      return `${prefix}${cardKind} ${merchant}`.replace(/^./, (letter) => letter.toUpperCase());
    }
  }

  if (merchant) {
    if (merchant === "YouTube Premium") {
      return merchant;
    }

    if (type === ReminderType.SUBSCRIPTION) {
      return hasInternetContext(text) ? `Langganan internet ${merchant}` : `Langganan ${merchant}`;
    }

    if (type === ReminderType.BILL) {
      return hasInternetContext(text) ? `Tagihan internet ${merchant}` : `Tagihan ${merchant}`;
    }

    return merchant;
  }

  const withoutLead = normalizeWhitespace(
    text
      .replace(new RegExp(`\\b\\d{1,2}\\s+(?:${monthNamePattern})\\s+\\d{4}\\b`, "gi"), " ")
      .replace(new RegExp(`(?:\\bbulan\\s+)?\\b(?:${monthNamePattern})\\s+\\d{4}\\b`, "gi"), " ")
      .replace(/\b(ingatkan|untuk|bayar|habis|masa berlaku|jatuh tempo|tiap|setiap|tanggal|tgl|dengan|biaya|harga|sebesar|senilai|valid|thru|nya|sampai|bulan|yang)\b/gi, " ")
      .replace(/(?:rp\s*)?\d{1,3}(?:[.,]\d{3})+|\d{4,}|\d+(?:[,.]\d+)?\s*(?:ribu|rb|juta)/gi, " ")
  );

  if (withoutLead) {
    return withoutLead.charAt(0).toUpperCase() + withoutLead.slice(1);
  }

  return type === ReminderType.SIM ? "SIM" : "Pengingat";
}

function buildNotes(dueDay: number | null) {
  return dueDay ? `Jatuh tempo setiap tanggal ${dueDay}` : null;
}

function buildExpirationNotes(text: string) {
  const normalized = text.toLowerCase();
  const match = normalized.match(new RegExp(`(?:\\bbulan\\s+)?\\b(${monthNamePattern})\\s+(\\d{4})\\b`));

  if (!match?.[1] || !match[2] || !hasExpirationContext(text)) {
    return null;
  }

  const label = getExpirationLabel(text);
  const monthYear = `${capitalizeMonthName(match[1])} ${match[2]}`;

  return label.toLowerCase().endsWith("sampai") ? `${label} ${monthYear}` : `${label} sampai ${monthYear}`;
}

function buildRelatedDocumentName(text: string, type: ReminderType, merchant: string | null, title: string) {
  if (type === ReminderType.DOCUMENT && merchant) {
    const cardKind = getCardKind(text);

    if (cardKind) {
      return `${cardKind} ${merchant}`.replace(/^./, (letter) => letter.toUpperCase());
    }
  }

  return ["STNK", "SIM", "WARRANTY", "LICENSE", "DOCUMENT"].includes(type) ? title : null;
}

export function suggestReminderFromTextFallback(text: string, now = new Date()): ReminderDraft {
  const type = inferType(text);
  const repeatType = inferRepeatType(text, type);
  const merchant = extractKnownMerchant(text);
  const { dueDate, dueDay, dueDateReason } = parseDueDateParts(text, now);
  const title = inferTitle(text, type, merchant);
  const amount = parseAmount(text);
  const notes = buildExpirationNotes(text) ?? buildNotes(dueDay);
  const relatedDocumentName = buildRelatedDocumentName(text, type, merchant, title);

  if (process.env.NODE_ENV === "development") {
    console.debug("[Reminder Parser] Quick text parsed", {
      originalText: text,
      title,
      type,
      dueDate,
      dueDateReason,
      amount,
      merchant,
      relatedDocumentName,
      dueDay,
      repeatType
    });
  }

  return {
    title,
    type,
    amount,
    dueDate,
    repeatType,
    notes,
    relatedMerchant: merchant,
    relatedDocumentName
  };
}

export async function suggestReminderFromText(text: string, now = new Date()): Promise<ReminderDraft> {
  const fallback = suggestReminderFromTextFallback(text, now);

  try {
    const provider = await createAiGenerationProvider();
    return await provider.generateJson<ReminderDraft>({
      role: "assistant",
      modelEnvKey: "GEMINI_ASSISTANT_MODEL",
      prompt: [
        {
          role: "user",
          parts: [
            {
              text: `Tanggal hari ini ${now.toISOString().slice(0, 10)}. Ubah teks pengingat ke JSON saja. Enum type: SUBSCRIPTION, BILL, VEHICLE_TAX, STNK, SIM, WARRANTY, LICENSE, DOCUMENT, OTHER. Enum repeatType: NONE, WEEKLY, MONTHLY, YEARLY, CUSTOM. Format dueDate YYYY-MM-DD atau null. Jangan menebak amount jika nominal tidak tertulis eksplisit. Untuk valid thru "September 2026", gunakan dueDate 2026-09-30. Untuk "tanggal 20", gunakan kejadian bulanan berikutnya. Normalisasi merchant umum seperti BCA, IndiHome, YouTube Premium, Spotify, Netflix, dan Google One. Teks: ${text}`
            }
          ]
        }
      ],
      parse(value) {
        const parsed = draftSchema.safeParse(value);

        if (!parsed.success) {
          throw parsed.error;
        }

        return parsed.data;
      }
    });
  } catch {
    return fallback;
  }
}
