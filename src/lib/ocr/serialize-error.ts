/**
 * Safe error serialization utilities.
 *
 * JavaScript Error objects have non-enumerable properties (name, message, stack),
 * so JSON.stringify(new Error("...")) produces "{}". This module explicitly
 * extracts those properties into plain objects that serialize correctly.
 */

import { existsSync, readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Field extraction helpers
// ---------------------------------------------------------------------------

/**
 * Read a string field from an unknown value. Returns undefined if the field
 * does not exist or is not a string.
 */
export function getStringField(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }

  const field = (value as Record<string, unknown>)[key];

  return typeof field === "string" && field.length > 0 ? field : undefined;
}

/**
 * Read a numeric field from an unknown value. Returns undefined if the field
 * does not exist or is not a finite number (avoids NaN from Number(undefined)).
 */
export function getNumericField(value: unknown, key: string): number | undefined {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }

  const field = (value as Record<string, unknown>)[key];

  if (typeof field === "number" && Number.isFinite(field)) {
    return field;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Garbage message detection
// ---------------------------------------------------------------------------

/**
 * Check whether a string looks like a garbage message built from undefined fields.
 * For example:
 * - "undefined undefined: undefined"
 * - "Error: undefined undefined: undefined"
 * - "undefined"
 * - ""
 */
function isGarbageMessage(message: string): boolean {
  const trimmed = message.trim();

  if (trimmed.length === 0) {
    return true;
  }

  // Strip any "ErrorClassName: " prefix (e.g., "Error: ", "GoogleError: ")
  const withoutPrefix = trimmed.replace(/^\w+:\s*/, "");

  // Check if the remaining content is only "undefined", whitespace, and colons
  return /^(undefined[\s:]*)+$/.test(withoutPrefix);
}

// ---------------------------------------------------------------------------
// Metadata serialization
// ---------------------------------------------------------------------------

/**
 * Safely serialize gRPC Metadata or other non-plain objects.
 * Returns undefined if the value is not serializable.
 */
export function safeSerializeMetadata(metadata: unknown): Record<string, unknown> | undefined {
  if (metadata === null || metadata === undefined) {
    return undefined;
  }

  // gRPC Metadata has a .getMap() method
  if (typeof metadata === "object" && "getMap" in metadata && typeof (metadata as { getMap: unknown }).getMap === "function") {
    try {
      return (metadata as { getMap: () => Record<string, unknown> }).getMap();
    } catch {
      return undefined;
    }
  }

  // gRPC Metadata also has a .toJSON() method
  if (typeof metadata === "object" && "toJSON" in metadata && typeof (metadata as { toJSON: unknown }).toJSON === "function") {
    try {
      return (metadata as { toJSON: () => Record<string, unknown> }).toJSON();
    } catch {
      return undefined;
    }
  }

  // Plain objects pass through
  if (typeof metadata === "object") {
    try {
      const serialized = JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
      return Object.keys(serialized).length > 0 ? serialized : undefined;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Shallow error serialization
// ---------------------------------------------------------------------------

export type SerializedError = {
  name?: string;
  message: string;
  code?: string | number;
  details?: string;
  reason?: string;
  status?: string | number;
  metadata?: Record<string, unknown>;
  cause?: { name: string; message: string };
  constructorName?: string;
  enumerableKeys?: string[];
  stack?: string;
};

/**
 * Serialize an error value into a plain JSON-safe object.
 *
 * Handles:
 * - Standard Error objects (non-enumerable name/message)
 * - Google Cloud / gRPC errors with code, details, reason, metadata, status
 * - Nested cause errors (recursively extracts cause.message)
 * - Non-Error thrown values (strings, numbers, etc.)
 * - Garbage messages from google-gax template interpolation of undefined fields
 */
export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const record = error as Error & {
      code?: string | number;
      details?: unknown;
      reason?: string;
      status?: string | number;
      metadata?: unknown;
      cause?: unknown;
    };

    // Extract cause info
    const cause =
      record.cause instanceof Error
        ? { name: record.cause.name, message: record.cause.message }
        : undefined;

    // Build the best possible message, avoiding garbage interpolation results.
    // google-gax can produce "undefined undefined: undefined" when gRPC status
    // fields are missing. String(error) produces "Error: undefined undefined: undefined".
    // We must filter all of these out and fall through to a clean fallback.
    const rawMessage = error.message;
    const causeMessage = cause?.message;
    const detailsStr = typeof record.details === "string" ? record.details : undefined;
    const reasonStr = typeof record.reason === "string" ? record.reason : undefined;
    const stringified = safeStringify(error);
    const toStringResult = String(error);

    const message =
      rawMessage && !isGarbageMessage(rawMessage)
        ? rawMessage
        : causeMessage && !isGarbageMessage(causeMessage)
          ? causeMessage
          : detailsStr && !isGarbageMessage(detailsStr)
            ? detailsStr
            : reasonStr && !isGarbageMessage(reasonStr)
              ? reasonStr
              : stringified && !isGarbageMessage(stringified)
                ? stringified
                : toStringResult && !isGarbageMessage(toStringResult)
                  ? toStringResult
                  : "Unknown error";

    // Collect enumerable keys for diagnostic purposes
    const enumerableKeys = Object.keys(record);

    // Read code safely, avoiding NaN
    const code = getNumericField(record, "code") ?? getStringField(record, "code");

    return {
      name: error.name,
      message,
      code,
      details: detailsStr,
      reason: record.reason,
      status: getNumericField(record, "status") ?? getStringField(record, "status"),
      metadata: safeSerializeMetadata(record.metadata),
      cause,
      constructorName: error.constructor?.name,
      enumerableKeys: enumerableKeys.length > 0 ? enumerableKeys : undefined
    };
  }

  return {
    message: String(error)
  };
}

/**
 * Deeply serialize a Google Cloud / gRPC error, including nested cause chain,
 * constructor name, enumerable keys, and development-only stack trace.
 *
 * This is used for comprehensive backend terminal logging, not for frontend payloads.
 */
export function serializeGoogleError(error: unknown): SerializedError {
  const base = serializeError(error);
  const isDevelopment = process.env.NODE_ENV === "development";

  if (isDevelopment && error instanceof Error) {
    base.stack = error.stack;
  }

  return base;
}

// ---------------------------------------------------------------------------
// Deep recursive error serialization
// ---------------------------------------------------------------------------

/**
 * A deeply-serialized error node including full cause chain, errors array,
 * own property names (including non-enumerable), and response data.
 */
export type DeepSerializedError = {
  constructorName?: string;
  name?: string;
  message: string;
  code?: string | number;
  details?: string;
  reason?: string;
  status?: string | number;
  ownPropertyNames?: string[];
  enumerableKeys?: string[];
  metadata?: Record<string, unknown>;
  stack?: string;
  cause?: DeepSerializedError;
  errors?: DeepSerializedError[];
  response?: Record<string, unknown>;
};

/** Fields that must never appear in serialized output. */
const sensitiveFields = new Set([
  "private_key",
  "private_key_id",
  "access_token",
  "refresh_token",
  "client_secret",
  "token"
]);

/**
 * Recursively serialize an error and its entire cause chain up to maxDepth.
 *
 * Extracts:
 * - constructorName, name, message, code, details, reason, status
 * - ownPropertyNames (Object.getOwnPropertyNames)
 * - enumerableKeys (Object.keys)
 * - metadata (safely serialized)
 * - cause (recursive)
 * - errors[] (recursive, for AggregateError-like errors)
 * - response (safely serialized, secrets stripped)
 * - stack (development only)
 *
 * Never includes private_key, tokens, or credential JSON contents.
 */
export function deepSerializeError(error: unknown, maxDepth = 4): DeepSerializedError {
  return deepSerializeErrorInternal(error, 0, maxDepth);
}

function deepSerializeErrorInternal(error: unknown, depth: number, maxDepth: number): DeepSerializedError {
  if (depth >= maxDepth) {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  const record = error as Error & Record<string, unknown>;
  const isDevelopment = process.env.NODE_ENV === "development";

  // Collect property names for diagnostics
  const ownPropertyNames = safeGetOwnPropertyNames(record);
  const enumerableKeys = Object.keys(record);

  // Extract string-safe fields
  const detailsRaw = record.details;
  const detailsStr =
    typeof detailsRaw === "string" && detailsRaw.length > 0
      ? detailsRaw
      : detailsRaw !== undefined && detailsRaw !== null
        ? safeStringify(detailsRaw) ?? undefined
        : undefined;

  // Build message with garbage filtering
  const rawMessage = error.message;
  const causeMsg = record.cause instanceof Error ? record.cause.message : undefined;

  const message =
    rawMessage && !isGarbageMessage(rawMessage)
      ? rawMessage
      : causeMsg && !isGarbageMessage(causeMsg)
        ? causeMsg
        : detailsStr && !isGarbageMessage(detailsStr)
          ? detailsStr
          : "Unknown error";

  const result: DeepSerializedError = {
    constructorName: error.constructor?.name,
    name: error.name,
    message,
    code: getNumericField(record, "code") ?? getStringField(record, "code"),
    details: detailsStr,
    reason: getStringField(record, "reason"),
    status: getNumericField(record, "status") ?? getStringField(record, "status"),
    ownPropertyNames: ownPropertyNames.length > 0 ? ownPropertyNames : undefined,
    enumerableKeys: enumerableKeys.length > 0 ? enumerableKeys : undefined,
    metadata: safeSerializeMetadata(record.metadata)
  };

  if (isDevelopment) {
    result.stack = error.stack;
  }

  // Recursively serialize cause chain
  if (record.cause instanceof Error) {
    result.cause = deepSerializeErrorInternal(record.cause, depth + 1, maxDepth);
  }

  // Recursively serialize errors array (AggregateError, google-gax retry errors)
  if (Array.isArray(record.errors)) {
    result.errors = record.errors
      .filter((item): item is Error => item instanceof Error)
      .slice(0, 5)
      .map((item) => deepSerializeErrorInternal(item, depth + 1, maxDepth));
  }

  // Safely serialize response data (strip secrets)
  if (record.response !== undefined && record.response !== null && typeof record.response === "object") {
    result.response = stripSecrets(
      safeSerializeMetadata(record.response) ?? {}
    );
  }

  return result;
}

/**
 * Get own property names safely — Object.getOwnPropertyNames can throw
 * on exotic objects.
 */
function safeGetOwnPropertyNames(obj: object): string[] {
  try {
    return Object.getOwnPropertyNames(obj).filter((key) => !sensitiveFields.has(key));
  } catch {
    return [];
  }
}

/** Strip sensitive keys from a plain object (shallow). */
function stripSecrets(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (!sensitiveFields.has(key)) {
      result[key] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : {};
}

/**
 * Recursively collect all text from a deep error chain for keyword searching.
 * Used by the error classifier to find keywords in nested causes.
 */
export function collectDeepErrorText(error: unknown, maxDepth = 4): string {
  const parts: string[] = [];
  collectDeepErrorTextInternal(error, parts, 0, maxDepth);
  return parts.join(" ").toLowerCase();
}

function collectDeepErrorTextInternal(error: unknown, parts: string[], depth: number, maxDepth: number): void {
  if (depth >= maxDepth) {
    return;
  }

  if (!(error instanceof Error)) {
    parts.push(String(error));
    return;
  }

  const record = error as Error & Record<string, unknown>;

  parts.push(error.message);
  parts.push(error.name);

  if (typeof record.code === "number") {
    parts.push(String(record.code));
  } else if (typeof record.code === "string") {
    parts.push(record.code);
  }

  if (typeof record.details === "string") {
    parts.push(record.details);
  }

  if (typeof record.reason === "string") {
    parts.push(record.reason);
  }

  if (typeof record.status === "string") {
    parts.push(record.status);
  }

  if (typeof record.note === "string") {
    parts.push(record.note);
  }

  // Recurse into cause
  if (record.cause instanceof Error) {
    collectDeepErrorTextInternal(record.cause, parts, depth + 1, maxDepth);
  }

  // Recurse into errors array
  if (Array.isArray(record.errors)) {
    for (const item of record.errors) {
      if (item instanceof Error) {
        collectDeepErrorTextInternal(item, parts, depth + 1, maxDepth);
      }
    }
  }
}

/**
 * Extract the deepest meaningful message from an error's cause chain.
 * Returns the first non-garbage message found walking from the outermost
 * error down through .cause and .errors[0].
 */
export function extractDeepestMessage(error: unknown, maxDepth = 4): string {
  let current: unknown = error;
  let best = "Unknown error";

  for (let depth = 0; depth < maxDepth && current instanceof Error; depth++) {
    const record = current as Error & Record<string, unknown>;

    if (!isGarbageMessage(record.message)) {
      best = record.message;
    }

    // Prefer cause, fallback to first error in errors[]
    if (record.cause instanceof Error) {
      current = record.cause;
    } else if (Array.isArray(record.errors) && record.errors[0] instanceof Error) {
      current = record.errors[0];
    } else {
      break;
    }
  }

  // Check the last level
  if (current instanceof Error && !isGarbageMessage(current.message)) {
    best = current.message;
  }

  return best;
}

// ---------------------------------------------------------------------------
// Credential file diagnostics
// ---------------------------------------------------------------------------

export type CredentialDiagnostics = {
  credentialFilePresent: boolean;
  credentialFileReadable: boolean;
  credentialProjectId?: string;
  credentialClientEmail?: string;
  credentialType?: string;
  credentialError?: string;
};

/**
 * Check the credential file pointed to by GOOGLE_APPLICATION_CREDENTIALS.
 *
 * Extracts only safe fields (client_email, project_id, type).
 * Never exposes private_key, tokens, or full file contents.
 */
export function checkCredentialFile(): CredentialDiagnostics {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

  if (!credentialPath) {
    return {
      credentialFilePresent: false,
      credentialFileReadable: false,
      credentialError: "GOOGLE_APPLICATION_CREDENTIALS is not set"
    };
  }

  if (!existsSync(credentialPath)) {
    return {
      credentialFilePresent: false,
      credentialFileReadable: false,
      credentialError: `File not found: ${credentialPath}`
    };
  }

  try {
    const content = readFileSync(credentialPath, "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;

    return {
      credentialFilePresent: true,
      credentialFileReadable: true,
      credentialProjectId: typeof parsed.project_id === "string" ? parsed.project_id : undefined,
      credentialClientEmail: typeof parsed.client_email === "string" ? parsed.client_email : undefined,
      credentialType: typeof parsed.type === "string" ? parsed.type : undefined
    };
  } catch (readError) {
    return {
      credentialFilePresent: true,
      credentialFileReadable: false,
      credentialError: readError instanceof Error ? readError.message : String(readError)
    };
  }
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/**
 * Try to JSON.stringify a value safely. Returns undefined on failure.
 * Avoids errors from circular references or non-serializable objects.
 */
function safeStringify(value: unknown): string | undefined {
  try {
    const result = JSON.stringify(value);
    // JSON.stringify(Error) → "{}" due to non-enumerable properties, not useful
    if (result === "{}" || result === "null" || result === "undefined") {
      return undefined;
    }
    return result;
  } catch {
    return undefined;
  }
}
