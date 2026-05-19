import assert from "node:assert/strict";
import test from "node:test";

import { settingsSections } from "./settings-sections";

test("settings page exposes required sections", () => {
  assert.deepEqual([...settingsSections], ["Akun", "Tampilan", "AI & OCR", "Data", "Preferensi"]);
});
