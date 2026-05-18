import assert from "node:assert/strict";
import test from "node:test";

import { themeOptions } from "@/components/theme/theme-options";

test("defines Indonesian theme options", () => {
  assert.deepEqual(themeOptions, [
    { value: "light", label: "Terang" },
    { value: "dark", label: "Gelap" },
    { value: "system", label: "Ikuti Sistem" }
  ]);
});
