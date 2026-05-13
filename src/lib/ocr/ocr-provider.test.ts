import assert from "node:assert/strict";
import test from "node:test";

import { resolveFallbackOcrProviderName, resolveOcrProviderName } from "./ocr-provider";

test("defaults to Google Document AI OCR provider", () => {
  assert.equal(resolveOcrProviderName({}), "google-document-ai");
});

test("resolves configured OCR provider names", () => {
  assert.equal(resolveOcrProviderName({ OCR_PROVIDER: "google-document-ai" }), "google-document-ai");
  assert.equal(resolveOcrProviderName({ OCR_PROVIDER: "tesseract" }), "tesseract");
});

test("resolves optional fallback OCR provider", () => {
  assert.equal(resolveFallbackOcrProviderName({}), undefined);
  assert.equal(resolveFallbackOcrProviderName({ OCR_FALLBACK_PROVIDER: "tesseract" }), "tesseract");
});

test("rejects unsupported OCR provider names", () => {
  assert.throws(() => resolveOcrProviderName({ OCR_PROVIDER: "browser" }), /Unsupported OCR_PROVIDER/);
  assert.throws(() => resolveFallbackOcrProviderName({ OCR_FALLBACK_PROVIDER: "browser" }), /Unsupported OCR_FALLBACK_PROVIDER/);
});
