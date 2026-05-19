import assert from "node:assert/strict";
import test from "node:test";

import { parseSidebarCollapsedValue, serializeSidebarCollapsedValue, sidebarStorageKey } from "@/components/app/sidebar-state";

test("uses the expected sidebar localStorage key", () => {
  assert.equal(sidebarStorageKey, "scanhemat-sidebar-collapsed");
});

test("defaults sidebar to expanded when no persisted state exists", () => {
  assert.equal(parseSidebarCollapsedValue(null), false);
});

test("parses persisted collapsed state", () => {
  assert.equal(parseSidebarCollapsedValue("true"), true);
  assert.equal(parseSidebarCollapsedValue("false"), false);
});

test("serializes sidebar collapsed state", () => {
  assert.equal(serializeSidebarCollapsedValue(true), "true");
  assert.equal(serializeSidebarCollapsedValue(false), "false");
});
