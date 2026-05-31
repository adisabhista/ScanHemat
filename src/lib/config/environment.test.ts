import assert from "node:assert/strict";
import test from "node:test";

import { validateProductionEnvironment } from "./environment";

const validEnvironment = {
  DATABASE_URL: "postgresql://user:password@localhost:5432/scanhemat",
  NEXTAUTH_URL: "https://scanhemat.example.com",
  NEXTAUTH_SECRET: "a-secure-secret-with-at-least-32-characters",
  MAX_RECEIPT_UPLOAD_MB: "8",
  OCR_PROVIDER: "google-document-ai",
  GOOGLE_CLOUD_PROJECT_ID: "project",
  GOOGLE_CLOUD_LOCATION: "us",
  GOOGLE_DOCUMENT_AI_PROCESSOR_ID: "processor",
  AI_GENERATION_PROVIDER: "gemini-api",
  GEMINI_API_KEY: "secret",
  GEMINI_RECEIPT_MODEL: "gemini-3.5-flash",
  GEMINI_ASSISTANT_MODEL: "gemini-3.5-flash",
  GEMINI_VISION_MODEL: "gemini-3.5-flash",
  GEMINI_FALLBACK_MODEL: "gemini-2.5-flash",
  RECEIPT_EXTRACTION_STRATEGY: "hybrid",
  RECEIPT_STORAGE_PROVIDER: "gcs",
  GCS_RECEIPT_BUCKET: "bucket"
};

test("production environment validation accepts complete server configuration", () => {
  assert.deepEqual(validateProductionEnvironment(validEnvironment), {
    ok: true,
    storageProvider: "gcs"
  });
});

test("production environment validation catches missing required configuration safely", () => {
  assert.throws(
    () => validateProductionEnvironment({ ...validEnvironment, DATABASE_URL: "", GEMINI_API_KEY: "" }),
    (error) =>
      error instanceof Error &&
      error.message.includes("DATABASE_URL is required") &&
      error.message.includes("GEMINI_API_KEY is required") &&
      !error.message.includes("postgresql://user:password")
  );
});

test("production environment validation requires HTTPS auth URL", () => {
  assert.throws(() => validateProductionEnvironment({ ...validEnvironment, NEXTAUTH_URL: "http://scanhemat.example.com" }), /must use HTTPS/);
});
