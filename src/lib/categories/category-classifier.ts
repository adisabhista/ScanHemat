import type { ParsedReceiptItem } from "@/lib/parser/receipt-parser";

export const transactionCategoryNames = [
  "Elektronik",
  "Hiburan",
  "Kebutuhan Rumah",
  "Kesehatan",
  "Lainnya",
  "Makanan",
  "Pendidikan",
  "Transportasi"
] as const;

export type TransactionCategoryName = (typeof transactionCategoryNames)[number];

export type CategoryClassification = {
  name: TransactionCategoryName;
  confidence: number;
  reason: string | null;
  source: "gemini" | "fallback" | "default";
};

export type CategoryOption = {
  id: string;
  name: string;
};

type CategoryRule = {
  category: Exclude<TransactionCategoryName, "Lainnya">;
  keywords: string[];
  reason: string;
};

const categoryRules: CategoryRule[] = [
  {
    category: "Kebutuhan Rumah",
    keywords: [
      "super indo",
      "pt lion super indo",
      "indomaret",
      "alfamart",
      "alfamidi",
      "hypermart",
      "transmart",
      "supermarket",
      "minimarket",
      "grocery",
      "household",
      "toko kelontong",
      "sembako",
      "kebutuhan rumah",
      "sabun",
      "deterjen",
      "tissue",
      "colgate",
      "pasta gigi",
      "sikat gigi",
      "odol"
    ],
    reason: "Merchant atau item cocok dengan supermarket, minimarket, grocery, atau kebutuhan rumah."
  },
  {
    category: "Makanan",
    keywords: [
      "restaurant",
      "restoran",
      "cafe",
      "food stall",
      "beverage",
      "food delivery",
      "kfc",
      "mcdonald",
      "mcdonald's",
      "mcd",
      "starbucks",
      "warung makan",
      "resto",
      "makan",
      "minum",
      "kopi"
    ],
    reason: "Merchant atau item cocok dengan restoran, kafe, minuman, atau layanan makanan."
  },
  {
    category: "Kesehatan",
    keywords: [
      "pharmacy",
      "health store",
      "clinic",
      "hospital",
      "medicine",
      "guardian",
      "watsons",
      "apotek",
      "klinik",
      "rumah sakit",
      "obat",
      "vitamin",
      "rs"
    ],
    reason: "Merchant atau item cocok dengan apotek, klinik, rumah sakit, obat, atau kesehatan."
  },
  {
    category: "Transportasi",
    keywords: [
      "gas station",
      "parking",
      "parkir",
      "toll",
      "tol",
      "ride-hailing",
      "bus",
      "train",
      "kereta",
      "transport",
      "transportasi",
      "pertamina",
      "spbu",
      "gojek",
      "grab"
    ],
    reason: "Merchant atau item cocok dengan bensin, parkir, tol, ride-hailing, atau transportasi."
  },
  {
    category: "Elektronik",
    keywords: [
      "electronics",
      "elektronik",
      "phone accessories",
      "aksesoris hp",
      "computer parts",
      "komputer",
      "toko komputer",
      "gadget",
      "laptop",
      "handphone",
      "smartphone",
      "charger",
      "powerbank"
    ],
    reason: "Merchant atau item cocok dengan toko elektronik, aksesori ponsel, komputer, atau gadget."
  },
  {
    category: "Hiburan",
    keywords: [
      "cinema",
      "bioskop",
      "movie",
      "games",
      "game",
      "entertainment",
      "karaoke",
      "recreation",
      "rekreasi",
      "xxi",
      "cgv"
    ],
    reason: "Merchant atau item cocok dengan bioskop, game, karaoke, rekreasi, atau hiburan."
  },
  {
    category: "Pendidikan",
    keywords: [
      "school",
      "sekolah",
      "university",
      "universitas",
      "course",
      "kursus",
      "books",
      "book",
      "buku",
      "stationery",
      "alat tulis",
      "pendidikan",
      "kampus"
    ],
    reason: "Merchant atau item cocok dengan sekolah, universitas, kursus, buku, atau alat tulis pendidikan."
  }
];

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " dan ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTokens(value: string) {
  return new Set(normalizeText(value).split(" ").filter(Boolean));
}

function keywordMatches(text: string, tokens: Set<string>, keyword: string) {
  const normalizedKeyword = normalizeText(keyword);

  if (!normalizedKeyword) {
    return false;
  }

  if (!normalizedKeyword.includes(" ") && normalizedKeyword.length <= 3) {
    return tokens.has(normalizedKeyword);
  }

  return text.includes(normalizedKeyword);
}

export function normalizeTransactionCategoryName(name: string | null | undefined): TransactionCategoryName | undefined {
  if (!name) {
    return undefined;
  }

  const normalizedName = normalizeText(name);

  if (normalizedName === "semua kategori") {
    return undefined;
  }

  return transactionCategoryNames.find((categoryName) => normalizeText(categoryName) === normalizedName);
}

export function classifyReceiptCategory({
  merchant,
  items,
  rawText
}: {
  merchant?: string;
  items?: ParsedReceiptItem[];
  rawText?: string;
}): CategoryClassification {
  const itemText = (items ?? []).map((item) => item.name).join(" ");
  const combinedText = normalizeText([merchant, itemText, rawText].filter(Boolean).join(" "));
  const tokens = getTokens(combinedText);

  for (const rule of categoryRules) {
    const matchedKeyword = rule.keywords.find((keyword) => keywordMatches(combinedText, tokens, keyword));

    if (matchedKeyword) {
      return {
        name: rule.category,
        confidence: merchant && keywordMatches(normalizeText(merchant), getTokens(merchant), matchedKeyword) ? 0.9 : 0.75,
        reason: `${rule.reason} Kata kunci: ${matchedKeyword}.`,
        source: "fallback"
      };
    }
  }

  return {
    name: "Lainnya",
    confidence: 0.4,
    reason: "Kategori tidak jelas dari merchant atau item.",
    source: "default"
  };
}

export function getGeminiCategoryClassification(category: {
  name: string | null;
  confidence: number;
  reason: string | null;
}): CategoryClassification | undefined {
  const normalizedName = normalizeTransactionCategoryName(category.name);

  if (!normalizedName) {
    return undefined;
  }

  return {
    name: normalizedName,
    confidence: Number.isFinite(category.confidence) ? category.confidence : 0,
    reason: category.reason,
    source: "gemini"
  };
}

export function findCategoryOptionByName(categories: CategoryOption[], categoryName: string | null | undefined) {
  const normalizedName = normalizeTransactionCategoryName(categoryName);

  if (!normalizedName) {
    return undefined;
  }

  return categories.find((category) => normalizeTransactionCategoryName(category.name) === normalizedName);
}

export function getDefaultCategoryOption(categories: CategoryOption[]) {
  return findCategoryOptionByName(categories, "Lainnya") ?? categories[0];
}
