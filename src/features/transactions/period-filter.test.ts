import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTransactionFilterSearchParams,
  getVisiblePeriodControls,
  normalizeTransactionFilters
} from "./period-filter";

const now = new Date(Date.UTC(2026, 4, 13));

test("month period shows and submits month and year", () => {
  assert.deepEqual(getVisiblePeriodControls("month"), {
    showMonth: true,
    showYear: true,
    showCustomRange: false
  });

  assert.equal(
    buildTransactionFilterSearchParams({ period: "month", month: 3, year: 2026, startDate: "2026-01-01" }, now).toString(),
    "period=month&month=3&year=2026"
  );
});

test("year period shows and submits only year", () => {
  assert.deepEqual(getVisiblePeriodControls("year"), {
    showMonth: false,
    showYear: true,
    showCustomRange: false
  });

  assert.equal(
    buildTransactionFilterSearchParams({ period: "year", month: 3, year: 2026, startDate: "2026-01-01" }, now).toString(),
    "period=year&year=2026"
  );
});

test("all period hides and submits no date controls", () => {
  assert.deepEqual(getVisiblePeriodControls("all"), {
    showMonth: false,
    showYear: false,
    showCustomRange: false
  });

  assert.equal(
    buildTransactionFilterSearchParams({ period: "all", month: 3, year: 2026, startDate: "2026-01-01", endDate: "2026-01-31" }, now).toString(),
    "period=all"
  );
});

test("custom period shows and submits date range only", () => {
  assert.deepEqual(getVisiblePeriodControls("custom"), {
    showMonth: false,
    showYear: false,
    showCustomRange: true
  });

  assert.equal(
    buildTransactionFilterSearchParams({ period: "custom", month: 3, year: 2026, startDate: "2026-01-01", endDate: "2026-01-31" }, now).toString(),
    "period=custom&startDate=2026-01-01&endDate=2026-01-31"
  );
});

test("normalization drops hidden URL values", () => {
  assert.deepEqual(
    normalizeTransactionFilters({ period: "all", month: 3, year: 2026, startDate: "2026-01-01", endDate: "2026-01-31", categoryId: "cat-1" }, now),
    { period: "all", categoryId: "cat-1", search: undefined }
  );
  assert.deepEqual(
    normalizeTransactionFilters({ period: "year", month: 3, year: 2026, startDate: "2026-01-01" }, now),
    { period: "year", year: 2026, categoryId: undefined, search: undefined }
  );
});

test("normalizes and serializes transaction search", () => {
  const filters = normalizeTransactionFilters({ period: "all", search: "  kopi  " }, now);
  const params = buildTransactionFilterSearchParams(filters, now);

  assert.equal(filters.search, "kopi");
  assert.equal(params.get("search"), "kopi");
});
