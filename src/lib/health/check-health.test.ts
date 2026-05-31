import assert from "node:assert/strict";
import test from "node:test";

import { checkHealth } from "./check-health";

test("health check returns ok when database and storage are reachable", async () => {
  const result = await checkHealth({
    checkDatabase: async () => undefined,
    checkStorage: async () => undefined
  });

  assert.deepEqual(result, {
    healthy: true,
    checks: {
      database: "ok",
      storage: "ok"
    }
  });
});

test("health check returns degraded safely when a dependency fails", async () => {
  const result = await checkHealth({
    checkDatabase: async () => {
      throw new Error("database-url-with-secret");
    },
    checkStorage: async () => undefined
  });

  assert.deepEqual(result, {
    healthy: false,
    checks: {
      database: "error",
      storage: "ok"
    }
  });
  assert.ok(!JSON.stringify(result).includes("database-url-with-secret"));
});
