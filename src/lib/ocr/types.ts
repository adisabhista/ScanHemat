export type OcrProviderName = "google-document-ai" | "tesseract";

export type OcrInput = {
  content: Buffer;
  fileName: string;
  mimeType: string;
};

export type OcrResult = {
  rawText: string;
  provider: OcrProviderName;
  confidence?: number;
  pages: number;
};

export type OcrProviderEnv = {
  OCR_PROVIDER?: string;
  OCR_FALLBACK_PROVIDER?: string;
};

export type OcrErrorCode =
  | "configuration"
  | "authentication"
  | "permission"
  | "processor-not-found"
  | "unsupported-mime-type"
  | "quota"
  | "api-disabled"
  | "google-api"
  | "unknown";

export type OcrDebugPayload = {
  provider?: string;
  code: string;
  message: string;
  missingEnvKeys?: string[];
  presentEnvKeys?: string[];
  errorName?: string;
  googleCode?: number;
  googleDetails?: string;
  googleReason?: string;
  googleMetadata?: Record<string, unknown>;
  credentialFilePresent?: boolean;
  credentialFileReadable?: boolean;
  credentialClientEmail?: string;
  credentialProjectId?: string;
  credentialType?: string;
  credentialError?: string;
  configuredProjectId?: string;
  projectMismatch?: boolean;
  processorName?: string;
  deepError?: Record<string, unknown>;
};

export class OcrProcessingError extends Error {
  code: OcrErrorCode;
  userMessage: string;
  statusCode: number;
  cause?: unknown;
  details?: Record<string, unknown>;
  debug?: OcrDebugPayload;

  constructor({
    code,
    message,
    userMessage,
    statusCode = 500,
    cause,
    details,
    debug
  }: {
    code: OcrErrorCode;
    message: string;
    userMessage: string;
    statusCode?: number;
    cause?: unknown;
    details?: Record<string, unknown>;
    debug?: OcrDebugPayload;
  }) {
    super(message);
    this.name = "OcrProcessingError";
    this.code = code;
    this.userMessage = userMessage;
    this.statusCode = statusCode;
    this.cause = cause;
    this.details = details;
    this.debug = debug;
  }
}

export interface OcrProvider {
  name: OcrProviderName;
  extractText(input: OcrInput): Promise<OcrResult>;
}
