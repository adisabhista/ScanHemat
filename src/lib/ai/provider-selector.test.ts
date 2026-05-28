import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { resolveAiGenerationProviderName } from "./provider-selector";
import {
  AiGenerationError,
  DEFAULT_GEMINI_FALLBACK_MODEL,
  DEFAULT_GEMINI_PRIMARY_MODEL,
  getGeminiFallbackModel,
  getGeminiModelForRole,
  requireGeminiApiKey
} from "./providers/generation-provider";

test("provider selector defaults to Gemini API direct", () => {
  assert.equal(resolveAiGenerationProviderName({}), "gemini-api");
});

test("provider selector resolves configured providers", () => {
  assert.equal(resolveAiGenerationProviderName({ AI_GENERATION_PROVIDER: "gemini-api" }), "gemini-api");
  assert.equal(resolveAiGenerationProviderName({ AI_GENERATION_PROVIDER: "vertex-ai" }), "vertex-ai");
});

test("provider selector rejects unsupported providers", () => {
  assert.throws(() => resolveAiGenerationProviderName({ AI_GENERATION_PROVIDER: "browser" }), /Unsupported AI_GENERATION_PROVIDER/);
});

test("missing Gemini API key returns Indonesian configuration error", () => {
  assert.throws(
    () => requireGeminiApiKey({ GEMINI_API_KEY: "" }),
    (error) =>
      error instanceof AiGenerationError &&
      error.code === "configuration" &&
      error.userMessage === "Konfigurasi Gemini API belum lengkap."
  );
});

test("Gemini model defaults use Gemini 3.5 Flash primary and Gemini 2.5 Flash fallback", () => {
  assert.equal(DEFAULT_GEMINI_PRIMARY_MODEL, "gemini-3.5-flash");
  assert.equal(DEFAULT_GEMINI_FALLBACK_MODEL, "gemini-2.5-flash");
  assert.equal(getGeminiModelForRole("receipt", {}), "gemini-3.5-flash");
  assert.equal(getGeminiModelForRole("assistant", {}), "gemini-3.5-flash");
  assert.equal(getGeminiModelForRole("vision", {}), "gemini-3.5-flash");
  assert.equal(getGeminiFallbackModel({}), "gemini-2.5-flash");
});

test("Gemini role models fall back through receipt model and fallback model", () => {
  const env = {
    GEMINI_RECEIPT_MODEL: "gemini-receipt-custom",
    GEMINI_FALLBACK_MODEL: "gemini-fallback-custom"
  };

  assert.equal(getGeminiModelForRole("receipt", env), "gemini-receipt-custom");
  assert.equal(getGeminiModelForRole("assistant", env), "gemini-receipt-custom");
  assert.equal(getGeminiModelForRole("vision", env), "gemini-receipt-custom");
  assert.equal(getGeminiFallbackModel(env), "gemini-fallback-custom");
});

test("Gemini API provider retries model-unavailable errors with fallback model", () => {
  const source = readFileSync(join(process.cwd(), "src", "lib", "ai", "providers", "gemini-api-provider.ts"), "utf-8");

  assert.ok(source.includes("primaryError.code !== \"model-unavailable\""));
  assert.ok(source.includes("model: fallbackModel"));
  assert.ok(source.includes("fallbackUsed: true"));
  assert.ok(source.includes("Gemini API model fallback used"));
});

test("Gemini API provider returns safe Indonesian error when primary and fallback models fail", () => {
  const source = readFileSync(join(process.cwd(), "src", "lib", "ai", "providers", "gemini-api-provider.ts"), "utf-8");

  assert.ok(source.includes("Primary model ${primaryModel} and fallback model ${fallbackModel} are unavailable."));
  assert.ok(source.includes("Model Gemini tidak tersedia. Periksa konfigurasi model AI."));
});

test("Document AI OCR provider does not depend on generative AI model configuration", () => {
  const source = readFileSync(join(process.cwd(), "src", "lib", "ocr", "providers", "google-document-ai-provider.ts"), "utf-8");

  assert.ok(source.includes("GOOGLE_DOCUMENT_AI_PROCESSOR_ID"));
  assert.ok(!source.includes("GEMINI_RECEIPT_MODEL"));
  assert.ok(!source.includes("GEMINI_FALLBACK_MODEL"));
  assert.ok(!source.includes("AI_GENERATION_PROVIDER"));
});

test("client components do not reference Gemini API key", () => {
  const srcFiles = listFiles(join(process.cwd(), "src")).filter(
    (file) => (file.endsWith(".ts") || file.endsWith(".tsx")) && !file.endsWith(".test.ts")
  );

  for (const file of srcFiles) {
    const content = readFileSync(file, "utf-8");

    if (content.includes("\"use client\"") || content.includes("'use client'")) {
      assert.ok(!content.includes("GEMINI_API_KEY"), `${file} must not reference GEMINI_API_KEY`);
    }
  }
});

test("public Gemini API key environment variable is not defined", () => {
  const publicGeminiKey = ["NEXT", "PUBLIC", "GEMINI", "API", "KEY"].join("_");
  const files = [
    ...listFiles(join(process.cwd(), "src")).filter(
      (file) => (file.endsWith(".ts") || file.endsWith(".tsx")) && !file.endsWith(".test.ts")
    ),
    join(process.cwd(), ".env.example")
  ];

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    assert.ok(!content.includes(publicGeminiKey), `${file} must not define ${publicGeminiKey}`);
  }
});

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);

    return stat.isDirectory() ? listFiles(path) : [path];
  });
}
