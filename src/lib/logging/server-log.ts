import "server-only";

type LogMetadata = Record<string, boolean | number | string | null | undefined>;

export function logServerEvent(event: string, metadata: LogMetadata = {}) {
  console.info(JSON.stringify({ event, ...metadata }));
}

export function getSafeErrorCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return "unknown";
  }

  const code = "code" in error ? error.code : undefined;
  return typeof code === "string" || typeof code === "number" ? String(code) : "unknown";
}
