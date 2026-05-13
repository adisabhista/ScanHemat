import type { AssistantIntent, AssistantIntentResult, AssistantMessage } from "./types";

const knownMerchants = [
  "shopee",
  "tokopedia",
  "lazada",
  "bukalapak",
  "indomaret",
  "alfamart",
  "alfamidi",
  "super indo",
  "kfc",
  "mcdonald",
  "starbucks",
  "pertamina",
  "guardian",
  "watsons"
];

function normalizeQuestion(message: string) {
  return message.toLowerCase().replace(/\s+/g, " ").trim();
}

function parseAmount(text: string) {
  const match = text.match(/(?:rp\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{4,})/i);

  if (!match) {
    return undefined;
  }

  const amount = Number(match[1].replace(/[.,]/g, ""));

  return Number.isFinite(amount) ? amount : undefined;
}

export function extractMerchantName(message: string) {
  const normalized = normalizeQuestion(message);
  const known = knownMerchants.find((merchant) => normalized.includes(merchant));

  if (known) {
    return known
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  const belanjaMatch = normalized.match(/belanja\s+(.+?)(?:\s+bulan|\s+tahun|\s+minggu|\s+ini|\s+berapa|$)/);
  if (belanjaMatch?.[1]) {
    return belanjaMatch[1].trim();
  }

  const tokoMatch = normalized.match(/(?:di|toko|merchant)\s+(.+?)(?:\s+bulan|\s+tahun|\s+ini|$)/);
  if (tokoMatch?.[1]) {
    return tokoMatch[1].trim();
  }

  return undefined;
}

export function extractItemKeyword(message: string) {
  const normalized = normalizeQuestion(message);
  const keywordMatch = normalized.match(/(?:harga|item|barang|produk)\s+(.+?)(?:\s+bulan|\s+tahun|\s+terakhir|$)/);

  if (keywordMatch?.[1]) {
    return keywordMatch[1].replace(/\b(item|barang|produk)\b/g, "").trim();
  }

  return normalized
    .replace(/\b(berapa|riwayat|harga|item|barang|produk|yang|pernah|dibeli|beli|saya)\b/g, "")
    .trim();
}

export function classifyAssistantIntent(message: string): AssistantIntentResult {
  const normalized = normalizeQuestion(message);
  const thresholdAmount = parseAmount(normalized);

  if (/\b(anggaran|budget)\b/.test(normalized)) {
    return { intent: "budget_status" };
  }

  if (/\b(transaksi|pengeluaran|belanja)\b/.test(normalized) && /\b(paling tinggi|tertinggi|terbesar|paling besar|paling mahal|termahal|top)\b/.test(normalized)) {
    return { intent: "largest_transactions" };
  }

  if (/\b(bandingkan tiap bulan|per bulan|bulan mana|bulanan|tiap bulan)\b/.test(normalized)) {
    return { intent: "monthly_breakdown" };
  }

  if (/\b(harga|item|barang|produk)\b/.test(normalized)) {
    return { intent: "item_price_history", itemKeyword: extractItemKeyword(message) };
  }

  if (/\b(transaksi kecil|kecil|receh|sering terjadi|sering|di bawah|dibawah)\b/.test(normalized)) {
    return { intent: "small_frequent_transactions", thresholdAmount };
  }

  if (/\b(tidak biasa|aneh|mencurigakan|unusual|outlier)\b/.test(normalized)) {
    return { intent: "unusual_transactions" };
  }

  if (/\b(hemat|saran|tips|bulan depan|kurangi|mengurangi|boros)\b/.test(normalized)) {
    return { intent: "savings_advice" };
  }

  if (/\b(kategori|paling besar|terbesar|terbanyak)\b/.test(normalized)) {
    return { intent: "category_breakdown" };
  }

  const merchantName = extractMerchantName(message);
  if (merchantName || /\b(merchant|toko|penjual)\b/.test(normalized)) {
    return { intent: "merchant_breakdown", merchantName };
  }

  if (/\b(terakhir|terbaru|recent|riwayat)\b/.test(normalized)) {
    return { intent: "recent_transactions" };
  }

  if (isFollowUpQuestion(normalized)) {
    return { intent: "follow_up" };
  }

  return { intent: "spending_summary" };
}

export function isFollowUpQuestion(normalizedMessage: string) {
  return /\b(bulan lainnya|bulan lain|bulan sebelumnya|bulan lalu|untuk tahun ini|keseluruhan tahun|semua waktu|yang lainnya|bandingkan dengan bulan lalu|untuk itu|kalau itu|untuk periode itu)\b/.test(normalizedMessage);
}

function getPreviousUserMessages(messages: AssistantMessage[]) {
  return messages.filter((message) => message.role === "user").slice(0, -1).reverse();
}

function resolvePreviousIntent(messages: AssistantMessage[]): AssistantIntent | undefined {
  const previousMessage = getPreviousUserMessages(messages)
    .map((message) => classifyAssistantIntent(message.content))
    .find((result) => result.intent !== "follow_up");

  return previousMessage?.intent;
}

export function resolveAssistantIntent(messages: AssistantMessage[]): AssistantIntentResult {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");

  if (!latestUserMessage) {
    return {
      intent: "follow_up",
      needsClarification: true,
      clarifyingQuestion: "Maksud Anda ingin melihat bulan sebelumnya, semua bulan, atau bulan tertentu?"
    };
  }

  const latest = normalizeQuestion(latestUserMessage.content);
  const directIntent = classifyAssistantIntent(latestUserMessage.content);
  const previousIntent = resolvePreviousIntent(messages);

  if (directIntent.intent !== "follow_up") {
    return { ...directIntent, previousIntent };
  }

  if (!previousIntent) {
    return {
      intent: "follow_up",
      previousIntent,
      needsClarification: true,
      clarifyingQuestion: "Maksud Anda ingin melihat bulan sebelumnya, semua bulan, atau bulan tertentu?"
    };
  }

  if (/\b(bulan lainnya|bulan lain|yang lainnya|bandingkan dengan bulan lalu|bandingkan tiap bulan)\b/.test(latest)) {
    return {
      intent: "monthly_breakdown",
      previousIntent
    };
  }

  return {
    intent: previousIntent,
    previousIntent
  };
}
