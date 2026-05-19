import assert from "node:assert/strict";
import test from "node:test";

import { getSidebarActiveMarkerClassName, getSidebarTooltipLabel } from "./sidebar-nav";

test("collapsed sidebar exposes Indonesian tooltip label", () => {
  assert.equal(getSidebarTooltipLabel("Dasbor", true), "Dasbor");
  assert.equal(getSidebarTooltipLabel("Dasbor", false), undefined);
});

test("collapsed active sidebar item has active marker", () => {
  assert.match(getSidebarActiveMarkerClassName(true, true), /bg-brand-600/);
  assert.equal(getSidebarActiveMarkerClassName(false, true), "");
  assert.equal(getSidebarActiveMarkerClassName(true, false), "");
});
