import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("Docker configuration does not copy local environment files", () => {
  const dockerIgnore = readFileSync(join(process.cwd(), ".dockerignore"), "utf-8");

  assert.ok(dockerIgnore.includes(".env.*"));
  assert.ok(dockerIgnore.includes("*credentials*.json"));
});

test("AI diagnostic prints only Gemini API key presence", () => {
  const source = readFileSync(join(process.cwd(), "scripts", "test-gemini-receipt-extractor.ts"), "utf-8");

  assert.ok(source.includes("GEMINI_API_KEY exists"));
  assert.ok(!source.includes("GEMINI_API_KEY: ${process.env.GEMINI_API_KEY}"));
});

test("receipt APIs expose authenticated preview URL instead of stored object path", () => {
  const uploadRoute = readFileSync(join(process.cwd(), "src", "app", "api", "receipts", "upload", "route.ts"), "utf-8");

  assert.ok(uploadRoute.includes("previewUrl: getReceiptPreviewUrl"));
  assert.ok(!uploadRoute.includes("filePath: updatedReceipt.filePath"));
});
