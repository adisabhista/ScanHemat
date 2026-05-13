import assert from "node:assert/strict";
import test from "node:test";

import { getTransactionDateRange } from "./queries";

const now = new Date(Date.UTC(2026, 4, 13));

test("all-time query does not require date values", () => {
  assert.deepEqual(
    getTransactionDateRange({ period: "all", month: 2, year: 2026, startDate: "2026-01-01", endDate: "2026-01-31" }, now),
    {}
  );
});

test("yearly query ignores month value", () => {
  const range = getTransactionDateRange({ period: "year", month: 5, year: 2026 }, now);

  assert.deepEqual(range, {
    start: new Date(Date.UTC(2026, 0, 1)),
    end: new Date(Date.UTC(2027, 0, 1))
  });
});
