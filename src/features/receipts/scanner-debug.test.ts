import assert from "node:assert/strict";
import test from "node:test";

import { shouldShowScannerDebug } from "./scanner-debug";

test("scanner debug is only visible in development", () => {
  assert.equal(shouldShowScannerDebug("development"), true);
  assert.equal(shouldShowScannerDebug("production"), false);
  assert.equal(shouldShowScannerDebug("test"), false);
});
