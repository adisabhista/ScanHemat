const requiredProductionKeys = [
  "DATABASE_URL",
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "MAX_RECEIPT_UPLOAD_MB",
  "OCR_PROVIDER",
  "GOOGLE_CLOUD_PROJECT_ID",
  "GOOGLE_CLOUD_LOCATION",
  "GOOGLE_DOCUMENT_AI_PROCESSOR_ID",
  "AI_GENERATION_PROVIDER",
  "GEMINI_API_KEY",
  "GEMINI_RECEIPT_MODEL",
  "GEMINI_ASSISTANT_MODEL",
  "GEMINI_VISION_MODEL",
  "GEMINI_FALLBACK_MODEL",
  "RECEIPT_EXTRACTION_STRATEGY",
  "RECEIPT_STORAGE_PROVIDER",
  "GCS_RECEIPT_BUCKET"
] as const;

type Environment = Record<string, string | undefined>;

export function validateProductionEnvironment(env: Environment = process.env) {
  const missingKeys = requiredProductionKeys.filter((key) => !env[key]?.trim());
  const errors = missingKeys.map((key) => `${key} is required in production.`);
  const nextAuthUrl = env.NEXTAUTH_URL?.trim();
  const nextAuthSecret = env.NEXTAUTH_SECRET?.trim();

  if (nextAuthUrl && !nextAuthUrl.startsWith("https://")) {
    errors.push("NEXTAUTH_URL must use HTTPS in production.");
  }

  if (nextAuthSecret && nextAuthSecret.length < 32) {
    errors.push("NEXTAUTH_SECRET must be at least 32 characters in production.");
  }

  if (env.RECEIPT_STORAGE_PROVIDER?.trim() && env.RECEIPT_STORAGE_PROVIDER.trim() !== "gcs") {
    errors.push("RECEIPT_STORAGE_PROVIDER must be gcs in production.");
  }

  if (errors.length > 0) {
    throw new Error(`Production environment is invalid: ${errors.join(" ")}`);
  }

  return {
    ok: true as const,
    storageProvider: "gcs" as const
  };
}
