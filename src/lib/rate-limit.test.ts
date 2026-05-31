import assert from "node:assert/strict";
import test from "node:test";

import { checkRateLimit, resetRateLimitsForTests } from "./rate-limit";

test("rate limiter blocks requests after the configured limit", () => {
  resetRateLimitsForTests();

  assert.equal(checkRateLimit({ key: "upload:user", limit: 2, windowMs: 1000, now: 1 }).allowed, true);
  assert.equal(checkRateLimit({ key: "upload:user", limit: 2, windowMs: 1000, now: 2 }).allowed, true);
  assert.equal(checkRateLimit({ key: "upload:user", limit: 2, windowMs: 1000, now: 3 }).allowed, false);
});

test("rate limiter resets after the configured window", () => {
  resetRateLimitsForTests();

  checkRateLimit({ key: "assistant:user", limit: 1, windowMs: 1000, now: 1 });
  assert.equal(checkRateLimit({ key: "assistant:user", limit: 1, windowMs: 1000, now: 1002 }).allowed, true);
});
