type HealthDependencies = {
  checkDatabase(): Promise<void>;
  checkStorage(): Promise<void>;
};

export async function checkHealth({ checkDatabase, checkStorage }: HealthDependencies) {
  const checks = {
    database: "ok",
    storage: "ok"
  };

  await Promise.all([
    checkDatabase().catch(() => {
      checks.database = "error";
    }),
    checkStorage().catch(() => {
      checks.storage = "error";
    })
  ]);

  return {
    healthy: checks.database === "ok" && checks.storage === "ok",
    checks
  };
}
