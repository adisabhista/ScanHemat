import assert from "node:assert/strict";
import test from "node:test";

import { resolveReceiptStorageProviderName } from "./storage-provider";
import { assertReceiptObjectPath, buildReceiptObjectPath, getSafeReceiptFileName } from "./storage-path";

test("storage provider defaults to local outside production", () => {
  assert.equal(resolveReceiptStorageProviderName({ NODE_ENV: "development" }), "local");
});

test("storage provider defaults to gcs in production", () => {
  assert.equal(resolveReceiptStorageProviderName({ NODE_ENV: "production" }), "gcs");
});

test("storage provider resolves explicit gcs provider", () => {
  assert.equal(resolveReceiptStorageProviderName({ RECEIPT_STORAGE_PROVIDER: "gcs" }), "gcs");
});

test("receipt object paths are user scoped and sanitized", () => {
  const filePath = buildReceiptObjectPath("user-1", "receipt-1", "../../my receipt.png");

  assert.equal(filePath, "receipts/user-1/receipt-1/my-receipt.png");
  assert.equal(assertReceiptObjectPath(filePath, "user-1"), filePath);
  assert.equal(getSafeReceiptFileName("../../../"), "receipt");
});

test("receipt object path validation rejects traversal and cross-user access", () => {
  assert.throws(() => assertReceiptObjectPath("receipts/user-1/../user-2/receipt/file.png", "user-1"));
  assert.throws(() => assertReceiptObjectPath("receipts/user-2/receipt/file.png", "user-1"));
});
