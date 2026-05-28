import { DocumentProcessorServiceClient } from "@google-cloud/documentai";

import {
  checkCredentialFile,
  collectDeepErrorText,
  type CredentialDiagnostics,
  type DeepSerializedError,
  deepSerializeError,
  extractDeepestMessage,
  getNumericField,
  getStringField,
  safeSerializeMetadata,
  serializeGoogleError
} from "@/lib/ocr/serialize-error";
import {
  type OcrDebugPayload,
  type OcrInput,
  OcrProcessingError,
  type OcrProvider,
  type OcrResult
} from "@/lib/ocr/types";

const supportedGoogleMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
export const googleDocumentAiLowConfidenceThreshold = 0.5;
const requiredGoogleEnvKeys = [
  "GOOGLE_CLOUD_PROJECT_ID",
  "GOOGLE_CLOUD_LOCATION",
  "GOOGLE_DOCUMENT_AI_PROCESSOR_ID"
] as const;

/**
 * All env keys relevant to Google Document AI OCR, including credential-related keys.
 * Used for diagnostics — never expose credential contents, only presence/absence.
 */
const diagnosticEnvKeys = [
  "OCR_PROVIDER",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_CLOUD_PROJECT_ID",
  "GOOGLE_CLOUD_LOCATION",
  "GOOGLE_DOCUMENT_AI_PROCESSOR_ID"
] as const;

type GoogleDocumentAiConfig = {
  projectId: string;
  location: string;
  processorId: string;
};

function getGoogleEnvStatus() {
  const present = requiredGoogleEnvKeys.filter((key) => Boolean(process.env[key]?.trim()));
  const missing = requiredGoogleEnvKeys.filter((key) => !process.env[key]?.trim());

  return { present, missing };
}

/**
 * Returns presence/absence of all diagnostic env keys (including credentials).
 * Never returns actual values — only key names.
 */
function getDiagnosticEnvStatus() {
  const present = diagnosticEnvKeys.filter((key) => Boolean(process.env[key]?.trim()));
  const missing = diagnosticEnvKeys.filter((key) => !process.env[key]?.trim());
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

  return {
    present,
    missing,
    credentialFileConfigured: Boolean(credentialPath),
    // Only expose the path in development, never the file contents
    credentialFilePath: process.env.NODE_ENV === "development" ? (credentialPath || undefined) : undefined
  };
}

/**
 * Build the processor resource name string that will be sent to the API.
 */
function buildProcessorName(config: GoogleDocumentAiConfig): string {
  return `projects/${config.projectId}/locations/${config.location}/processors/${config.processorId}`;
}

/**
 * Server-side diagnostic helper for development.
 *
 * Returns environment, credential, and configuration diagnostics.
 * Never returns private_key or credential file contents.
 */
export function validateGoogleOcrEnvironment() {
  const diag = getDiagnosticEnvStatus();
  const envStatus = getGoogleEnvStatus();
  const cred = checkCredentialFile();
  const configuredProjectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim();
  const location = process.env.GOOGLE_CLOUD_LOCATION?.trim();
  const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID?.trim();
  const processorName =
    configuredProjectId && location && processorId
      ? `projects/${configuredProjectId}/locations/${location}/processors/${processorId}`
      : undefined;

  return {
    presentEnvKeys: diag.present,
    missingEnvKeys: diag.missing,
    credentialFilePresent: cred.credentialFilePresent,
    credentialFileReadable: cred.credentialFileReadable,
    credentialClientEmail: cred.credentialClientEmail,
    credentialProjectId: cred.credentialProjectId,
    credentialType: cred.credentialType,
    credentialError: cred.credentialError,
    configuredProjectId,
    location,
    processorId,
    processorName,
    projectMismatch:
      cred.credentialProjectId && configuredProjectId
        ? cred.credentialProjectId !== configuredProjectId
        : undefined,
    requiredEnvPresent: envStatus.present,
    requiredEnvMissing: envStatus.missing
  };
}

function logGoogleEnvStatus() {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const validation = validateGoogleOcrEnvironment();

  console.debug("[OCR] Google Document AI env status", {
    presentEnvKeys: validation.presentEnvKeys,
    missingEnvKeys: validation.missingEnvKeys,
    credentialFilePresent: validation.credentialFilePresent,
    credentialFileReadable: validation.credentialFileReadable,
    credentialClientEmail: validation.credentialClientEmail,
    credentialProjectId: validation.credentialProjectId,
    configuredProjectId: validation.configuredProjectId,
    projectMismatch: validation.projectMismatch,
    processorName: validation.processorName
  });
}

function getGoogleDocumentAiConfig(): GoogleDocumentAiConfig {
  logGoogleEnvStatus();

  const { missing } = getGoogleEnvStatus();

  if (missing.length > 0) {
    const missingList = missing.join(", ");
    const developmentUserMessage = `Konfigurasi Google OCR belum lengkap. Key yang hilang: ${missingList}`;

    throw new OcrProcessingError({
      code: "configuration",
      message: `Missing required Google Document AI environment variables: ${missingList}`,
      userMessage:
        process.env.NODE_ENV === "development" ? developmentUserMessage : "Konfigurasi Google OCR belum lengkap.",
      details: {
        missingEnvKeys: missing,
        presentEnvKeys: requiredGoogleEnvKeys.filter((key) => !missing.includes(key))
      },
      debug: {
        provider: "google-document-ai",
        code: "MISSING_ENV",
        message: `Missing required Google Document AI environment variables: ${missingList}`,
        missingEnvKeys: missing,
        presentEnvKeys: requiredGoogleEnvKeys.filter((key) => !missing.includes(key))
      }
    });
  }

  return {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID!.trim(),
    location: process.env.GOOGLE_CLOUD_LOCATION!.trim(),
    processorId: process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID!.trim()
  };
}

// ---------------------------------------------------------------------------
// Safe field extraction from unknown errors
// ---------------------------------------------------------------------------

function getGoogleErrorCode(error: unknown): number | undefined {
  return getNumericField(error, "code");
}

function getGoogleErrorName(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.name;
  }

  return getStringField(error, "name");
}

/**
 * Extract a useful error message from a Google Cloud error.
 *
 * Falls through garbage messages and retry wrapper messages to find
 * the real underlying error message from the cause chain.
 */
function getGoogleErrorMessage(error: unknown): string {
  // Use deep extraction to walk the entire cause chain
  const deepMessage = extractDeepestMessage(error);

  if (deepMessage !== "Unknown error") {
    return deepMessage;
  }

  const serialized = serializeGoogleError(error);

  if (serialized.message && serialized.message !== "Unknown error") {
    return serialized.message;
  }

  return "Unknown Google Document AI error";
}

function getGoogleErrorDetails(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("details" in error)) {
    return undefined;
  }

  const details = (error as { details?: unknown }).details;

  if (typeof details === "string" && details.length > 0) {
    return details;
  }

  // gRPC errors sometimes have object/array details — stringify safely
  if (details !== null && details !== undefined) {
    try {
      return JSON.stringify(details);
    } catch {
      return String(details);
    }
  }

  return undefined;
}

function getGoogleErrorReason(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const reason = (error as { reason?: unknown }).reason;

  if (typeof reason === "string") {
    return reason;
  }

  const metadata = (error as { metadata?: unknown }).metadata;

  if (metadata && typeof metadata === "object" && "get" in metadata && typeof metadata.get === "function") {
    const reasons = metadata.get("reason");

    if (Array.isArray(reasons) && typeof reasons[0] === "string") {
      return reasons[0];
    }
  }

  return undefined;
}

/**
 * Find a gRPC/Google error code from the deepest error in the cause chain.
 */
function getDeepGoogleErrorCode(error: unknown, maxDepth = 4): number | undefined {
  let current: unknown = error;

  for (let depth = 0; depth < maxDepth; depth++) {
    if (!(current instanceof Error)) {
      break;
    }

    const code = getGoogleErrorCode(current);

    if (code !== undefined) {
      return code;
    }

    const record = current as Error & Record<string, unknown>;

    if (record.cause instanceof Error) {
      current = record.cause;
    } else if (Array.isArray(record.errors) && record.errors[0] instanceof Error) {
      current = record.errors[0];
    } else {
      break;
    }
  }

  return undefined;
}

function buildGoogleDebugPayload(
  error: unknown,
  code: string,
  options?: {
    message?: string;
    credential?: CredentialDiagnostics;
    processorName?: string;
    deepError?: DeepSerializedError;
  }
): OcrDebugPayload {
  const envStatus = getGoogleEnvStatus();
  const diag = getDiagnosticEnvStatus();
  const serialized = serializeGoogleError(error);
  const cred = options?.credential ?? checkCredentialFile();
  const deepMsg = extractDeepestMessage(error);
  const configuredProjectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim();

  return {
    provider: "google-document-ai",
    code,
    message: options?.message ?? (deepMsg !== "Unknown error" ? deepMsg : serialized.message),
    missingEnvKeys: [...envStatus.missing, ...(diag.credentialFileConfigured ? [] : ["GOOGLE_APPLICATION_CREDENTIALS"])],
    presentEnvKeys: [...envStatus.present, ...(diag.credentialFileConfigured ? ["GOOGLE_APPLICATION_CREDENTIALS"] : [])],
    errorName: serialized.name ?? getGoogleErrorName(error),
    googleCode: typeof serialized.code === "number" ? serialized.code : getDeepGoogleErrorCode(error),
    googleDetails: getGoogleErrorDetails(error) ?? serialized.details,
    googleReason: serialized.reason ?? getGoogleErrorReason(error),
    googleMetadata: safeSerializeMetadata(
      typeof error === "object" && error !== null && "metadata" in error
        ? (error as { metadata?: unknown }).metadata
        : undefined
    ),
    credentialFilePresent: cred.credentialFilePresent,
    credentialFileReadable: cred.credentialFileReadable,
    credentialClientEmail: cred.credentialClientEmail,
    credentialProjectId: cred.credentialProjectId,
    credentialType: cred.credentialType,
    credentialError: cred.credentialError,
    configuredProjectId,
    projectMismatch:
      cred.credentialProjectId && configuredProjectId
        ? cred.credentialProjectId !== configuredProjectId
        : undefined,
    processorName: options?.processorName,
    deepError: options?.deepError ?? deepSerializeError(error)
  };
}

export function classifyGoogleDocumentAiError(error: unknown): OcrProcessingError {
  if (error instanceof OcrProcessingError) {
    return error;
  }

  const code = getDeepGoogleErrorCode(error);
  const message = getGoogleErrorMessage(error);
  const normalized = collectDeepErrorText(error);
  const cred = checkCredentialFile();
  const deepError = deepSerializeError(error);

  // Build processor name for debug output
  const configuredProjectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim();
  const location = process.env.GOOGLE_CLOUD_LOCATION?.trim();
  const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID?.trim();
  const processorName =
    configuredProjectId && location && processorId
      ? `projects/${configuredProjectId}/locations/${location}/processors/${processorId}`
      : undefined;
  const debugOptions = { credential: cred, processorName, deepError };

  // --- Keyword-based classification using deep search (takes priority) ---

  if (
    normalized.includes("billing") &&
    !normalized.includes("permission_denied") &&
    !normalized.includes("permission denied")
  ) {
    return new OcrProcessingError({
      code: "api-disabled",
      message,
      userMessage: "Billing Google Cloud belum aktif untuk project ini.",
      cause: error,
      debug: buildGoogleDebugPayload(error, "BILLING_DISABLED", debugOptions)
    });
  }

  if (
    normalized.includes("api has not been used") ||
    normalized.includes("api has not been enabled") ||
    (normalized.includes("disabled") && (normalized.includes("api") || normalized.includes("service")))
  ) {
    return new OcrProcessingError({
      code: "api-disabled",
      message,
      userMessage: "Document AI API belum aktif di project Google Cloud.",
      cause: error,
      debug: buildGoogleDebugPayload(error, "API_DISABLED", debugOptions)
    });
  }

  if (
    code === 16 ||
    normalized.includes("unauthenticated") ||
    normalized.includes("could not load the default credentials") ||
    normalized.includes("google_application_credentials") ||
    normalized.includes("authentication")
  ) {
    return new OcrProcessingError({
      code: "authentication",
      message,
      userMessage: "Autentikasi Google Cloud gagal. Periksa GOOGLE_APPLICATION_CREDENTIALS.",
      cause: error,
      debug: buildGoogleDebugPayload(error, "UNAUTHENTICATED", debugOptions)
    });
  }

  if (code === 7 || normalized.includes("permission_denied") || normalized.includes("permission denied")) {
    return new OcrProcessingError({
      code: "permission",
      message,
      userMessage: "Akses Document AI ditolak. Periksa role IAM service account.",
      cause: error,
      debug: buildGoogleDebugPayload(error, "PERMISSION_DENIED", debugOptions)
    });
  }

  if (code === 5 || normalized.includes("not_found") || (normalized.includes("processor") && normalized.includes("not found"))) {
    return new OcrProcessingError({
      code: "processor-not-found",
      message,
      userMessage: "Processor Document AI tidak ditemukan. Periksa Project ID, Location, dan Processor ID.",
      statusCode: 404,
      cause: error,
      debug: buildGoogleDebugPayload(error, "NOT_FOUND", debugOptions)
    });
  }

  if (code === 3 || normalized.includes("invalid_argument") || normalized.includes("mime") || normalized.includes("unsupported")) {
    return new OcrProcessingError({
      code: "unsupported-mime-type",
      message,
      userMessage: "File tidak valid atau format tidak didukung oleh Google OCR.",
      statusCode: 400,
      cause: error,
      debug: buildGoogleDebugPayload(error, "INVALID_ARGUMENT", debugOptions)
    });
  }

  if (code === 8 || normalized.includes("resource_exhausted") || normalized.includes("quota")) {
    return new OcrProcessingError({
      code: "quota",
      message,
      userMessage: "Kuota Google OCR habis atau terkena batas penggunaan.",
      cause: error,
      debug: buildGoogleDebugPayload(error, "RESOURCE_EXHAUSTED", debugOptions)
    });
  }

  // --- Credential file issues (fallback when no keyword match) ---

  if (!cred.credentialFilePresent || !cred.credentialFileReadable) {
    return new OcrProcessingError({
      code: "authentication",
      message: message || "Credential file not found or unreadable",
      userMessage: "Autentikasi Google Cloud gagal. File credential tidak ditemukan atau tidak bisa dibaca.",
      cause: error,
      debug: buildGoogleDebugPayload(error, "CREDENTIAL_FILE_INVALID", debugOptions)
    });
  }

  if (cred.credentialProjectId && configuredProjectId && cred.credentialProjectId !== configuredProjectId) {
    return new OcrProcessingError({
      code: "configuration",
      message: `Credential project_id "${cred.credentialProjectId}" differs from GOOGLE_CLOUD_PROJECT_ID "${configuredProjectId}"`,
      userMessage: "Credential Google Cloud berasal dari project berbeda. Periksa service account JSON.",
      cause: error,
      debug: buildGoogleDebugPayload(error, "PROJECT_MISMATCH", debugOptions)
    });
  }

  return new OcrProcessingError({
    code: "google-api",
    message,
    userMessage: "Gagal membaca struk dengan Google OCR.",
    cause: error,
    debug: buildGoogleDebugPayload(error, "GOOGLE_API_ERROR", debugOptions)
  });
}

/**
 * Log a Google Document AI API error to the backend terminal with full diagnostics.
 */
function logGoogleApiError(error: unknown, processorName?: string) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const deepDebug = deepSerializeError(error);
  const validation = validateGoogleOcrEnvironment();
  const classifiedError = classifyGoogleDocumentAiError(error);
  const debug = classifiedError.debug;

  console.error("[OCR] Deep Google Document AI error", deepDebug);

  console.error("[OCR] Credential diagnostics", {
    credentialFilePresent: validation.credentialFilePresent,
    credentialFileReadable: validation.credentialFileReadable,
    credentialClientEmail: validation.credentialClientEmail,
    credentialProjectId: validation.credentialProjectId,
    credentialType: validation.credentialType,
    credentialError: validation.credentialError,
    configuredProjectId: validation.configuredProjectId,
    projectMismatch: validation.projectMismatch,
    processorName: processorName ?? validation.processorName,
    presentEnvKeys: validation.presentEnvKeys,
    missingEnvKeys: validation.missingEnvKeys
  });

  console.error("[OCR] Google Document AI API error (classified)", debug);
}

function getAverageConfidence(values: Array<number | null | undefined>) {
  const confidences = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (confidences.length === 0) {
    return undefined;
  }

  return confidences.reduce((total, value) => total + value, 0) / confidences.length;
}

export class GoogleDocumentAiOcrProvider implements OcrProvider {
  name = "google-document-ai" as const;

  async extractText(input: OcrInput): Promise<OcrResult> {
    if (!supportedGoogleMimeTypes.has(input.mimeType)) {
      throw new OcrProcessingError({
        code: "unsupported-mime-type",
        message: `Unsupported Google Document AI MIME type: ${input.mimeType}`,
        userMessage: "File tidak valid atau format tidak didukung oleh Google OCR.",
        statusCode: 400,
        debug: {
          provider: "google-document-ai",
          code: "INVALID_ARGUMENT",
          message: `Unsupported Google Document AI MIME type: ${input.mimeType}`,
          missingEnvKeys: getGoogleEnvStatus().missing,
          presentEnvKeys: getGoogleEnvStatus().present
        }
      });
    }

    let processorName: string | undefined;

    try {
      const config = getGoogleDocumentAiConfig();
      processorName = buildProcessorName(config);

      if (process.env.NODE_ENV === "development") {
        console.debug("[OCR] Calling Google Document AI", { processorName });
      }

      const apiEndpoint =
        config.location === "eu"
          ? "eu-documentai.googleapis.com"
          : config.location === "us"
            ? "us-documentai.googleapis.com"
            : `${config.location}-documentai.googleapis.com`;

      const client = new DocumentProcessorServiceClient({
        apiEndpoint
      });
      const [result] = await client.processDocument({
        name: processorName,
        rawDocument: {
          content: input.content.toString("base64"),
          mimeType: input.mimeType
        }
      });
      const document = result.document;
      const pages = document?.pages ?? [];

      return {
        rawText: document?.text?.trim() ?? "",
        provider: this.name,
        confidence: getAverageConfidence(pages.map((page) => page.layout?.confidence)),
        pages: pages.length
      };
    } catch (error) {
      logGoogleApiError(error, processorName);
      throw classifyGoogleDocumentAiError(error);
    }
  }
}

export function getGoogleDocumentAiDebugDetails(error: unknown) {
  const ocrError = error instanceof OcrProcessingError ? error : classifyGoogleDocumentAiError(error);
  const sourceError = ocrError.cause;
  const googleCode = sourceError ? getGoogleErrorCode(sourceError) : undefined;
  const googleMessage = sourceError ? getGoogleErrorMessage(sourceError) : ocrError.message;

  return {
    code: ocrError.code,
    userMessage: ocrError.userMessage,
    googleCode,
    googleMessage,
    details: ocrError.details,
    debug: ocrError.debug
  };
}
