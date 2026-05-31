import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { OcrProcessingError, resolveFallbackOcrProviderName, resolveOcrProviderName } from "./index";
import { classifyGoogleDocumentAiError, GoogleDocumentAiOcrProvider, validateGoogleOcrEnvironment } from "./providers/google-document-ai-provider";

test("defaults to Google Document AI OCR provider", () => {
  assert.equal(resolveOcrProviderName({}), "google-document-ai");
});

test("resolves configured OCR provider names", () => {
  assert.equal(resolveOcrProviderName({ OCR_PROVIDER: "google-document-ai" }), "google-document-ai");
  assert.equal(resolveOcrProviderName({ OCR_PROVIDER: "tesseract" }), "tesseract");
});

test("resolves optional fallback OCR provider", () => {
  assert.equal(resolveFallbackOcrProviderName({}), undefined);
  assert.equal(resolveFallbackOcrProviderName({ OCR_FALLBACK_PROVIDER: "tesseract" }), "tesseract");
});

test("rejects unsupported OCR provider names", () => {
  assert.throws(() => resolveOcrProviderName({ OCR_PROVIDER: "browser" }), OcrProcessingError);
  assert.throws(() => resolveFallbackOcrProviderName({ OCR_FALLBACK_PROVIDER: "browser" }), OcrProcessingError);
});

test("rejects unsupported Google Document AI MIME types", async () => {
  const provider = new GoogleDocumentAiOcrProvider();

  await assert.rejects(
    provider.extractText({
      content: Buffer.from("test"),
      fileName: "receipt.txt",
      mimeType: "text/plain"
    }),
    (error) =>
      error instanceof OcrProcessingError &&
      error.code === "unsupported-mime-type" &&
      error.userMessage === "File tidak valid atau format tidak didukung oleh Google OCR."
  );
});

test("maps missing Google Document AI config to Indonesian user message", async () => {
  const previousProjectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const previousLocation = process.env.GOOGLE_CLOUD_LOCATION;
  const previousProcessorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
  const provider = new GoogleDocumentAiOcrProvider();

  process.env.GOOGLE_CLOUD_PROJECT_ID = "";
  process.env.GOOGLE_CLOUD_LOCATION = "";
  process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID = "";

  try {
    await assert.rejects(
      provider.extractText({
        content: Buffer.from("test"),
        fileName: "receipt.png",
        mimeType: "image/png"
      }),
      (error) =>
        error instanceof OcrProcessingError &&
        error.code === "configuration" &&
        error.userMessage === "Konfigurasi Google OCR belum lengkap."
    );
  } finally {
    if (previousProjectId === undefined) {
      delete process.env.GOOGLE_CLOUD_PROJECT_ID;
    } else {
      process.env.GOOGLE_CLOUD_PROJECT_ID = previousProjectId;
    }

    if (previousLocation === undefined) {
      delete process.env.GOOGLE_CLOUD_LOCATION;
    } else {
      process.env.GOOGLE_CLOUD_LOCATION = previousLocation;
    }

    if (previousProcessorId === undefined) {
      delete process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
    } else {
      process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID = previousProcessorId;
    }
  }
});

test("maps Google unauthenticated errors", () => {
  const error = classifyGoogleDocumentAiError(Object.assign(new Error("Request had invalid authentication credentials."), { code: 16 }));

  assert.equal(error.code, "authentication");
  assert.equal(error.userMessage, "Autentikasi Google Cloud gagal. Periksa credential atau service account Cloud Run.");
  assert.equal(error.debug?.code, "UNAUTHENTICATED");
});

test("maps Google permission denied errors", () => {
  const error = classifyGoogleDocumentAiError(Object.assign(new Error("PERMISSION_DENIED: Permission denied"), { code: 7 }));

  assert.equal(error.code, "permission");
  assert.equal(error.userMessage, "Akses Document AI ditolak. Periksa role IAM service account.");
  assert.equal(error.debug?.code, "PERMISSION_DENIED");
});

test("maps Google processor not found errors", () => {
  const error = classifyGoogleDocumentAiError(Object.assign(new Error("Processor not found"), { code: 5 }));

  assert.equal(error.code, "processor-not-found");
  assert.equal(error.userMessage, "Processor Document AI tidak ditemukan. Periksa Project ID, Location, dan Processor ID.");
  assert.equal(error.debug?.code, "NOT_FOUND");
});

test("maps Google invalid argument errors", () => {
  const error = classifyGoogleDocumentAiError(Object.assign(new Error("INVALID_ARGUMENT: unsupported mime type"), { code: 3 }));

  assert.equal(error.code, "unsupported-mime-type");
  assert.equal(error.userMessage, "File tidak valid atau format tidak didukung oleh Google OCR.");
  assert.equal(error.debug?.code, "INVALID_ARGUMENT");
});

test("maps Google resource exhausted errors", () => {
  const error = classifyGoogleDocumentAiError(Object.assign(new Error("RESOURCE_EXHAUSTED: quota exceeded"), { code: 8 }));

  assert.equal(error.code, "quota");
  assert.equal(error.userMessage, "Kuota Google OCR habis atau terkena batas penggunaan.");
  assert.equal(error.debug?.code, "RESOURCE_EXHAUSTED");
});

test("maps Google API disabled errors", () => {
  const error = classifyGoogleDocumentAiError(
    Object.assign(new Error("Document AI API has not been used in project before or it is disabled."), { code: 7 })
  );

  assert.equal(error.code, "api-disabled");
  assert.equal(error.debug?.code, "API_DISABLED");
});

test("debug payload includes provider: google-document-ai", () => {
  const error = classifyGoogleDocumentAiError(Object.assign(new Error("test"), { code: 16 }));
  assert.equal(error.debug?.provider, "google-document-ai");
});

test("existing OcrProcessingError passes through unchanged", () => {
  const existing = new OcrProcessingError({
    code: "configuration",
    message: "Already classified",
    userMessage: "Konfigurasi Google OCR belum lengkap."
  });
  assert.strictEqual(classifyGoogleDocumentAiError(existing), existing);
});

// --- Retry wrapper / nested cause error tests ---

test("maps retry wrapper error with PERMISSION_DENIED cause", () => {
  const root = Object.assign(new Error("PERMISSION_DENIED: Access denied"), { code: 7 });
  const mid = Object.assign(new Error("retry failed"), { cause: root });
  const outer = Object.assign(new Error("Exception occurred in retry method that was not classified as transient"), {
    cause: mid,
    note: "Exception occurred in retry method that was not classified as transient"
  });

  const result = classifyGoogleDocumentAiError(outer);

  assert.equal(result.code, "permission");
  assert.equal(result.userMessage, "Akses Document AI ditolak. Periksa role IAM service account.");
  assert.equal(result.debug?.code, "PERMISSION_DENIED");
  assert.ok(result.debug?.deepError, "Expected deepError in debug");
});

test("maps retry wrapper error with NOT_FOUND cause", () => {
  const root = Object.assign(new Error("NOT_FOUND: Processor not found"), { code: 5 });
  const outer = Object.assign(new Error("Exception occurred in retry method that was not classified as transient"), {
    cause: root
  });

  const result = classifyGoogleDocumentAiError(outer);

  assert.equal(result.code, "processor-not-found");
  assert.equal(result.debug?.code, "NOT_FOUND");
});

test("maps retry wrapper error with API disabled cause", () => {
  const root = new Error("Document AI API has not been enabled");
  const outer = Object.assign(new Error("Exception occurred in retry method that was not classified as transient"), {
    cause: root
  });

  const result = classifyGoogleDocumentAiError(outer);

  assert.equal(result.code, "api-disabled");
});

test("maps retry wrapper error with billing cause", () => {
  const root = new Error("Billing is required for this service");
  const outer = Object.assign(new Error("Exception occurred in retry method that was not classified as transient"), {
    cause: root
  });

  const result = classifyGoogleDocumentAiError(outer);

  assert.equal(result.code, "api-disabled");
  assert.equal(result.userMessage, "Billing Google Cloud belum aktif untuk project ini.");
});

test("maps retry wrapper error with UNAUTHENTICATED cause", () => {
  const root = new Error("Could not load the default credentials");
  const outer = Object.assign(new Error("Exception occurred in retry method that was not classified as transient"), {
    cause: root
  });

  const result = classifyGoogleDocumentAiError(outer);

  assert.equal(result.code, "authentication");
  assert.equal(result.debug?.code, "UNAUTHENTICATED");
});

test("maps error in errors array with PERMISSION_DENIED", () => {
  const inner = Object.assign(new Error("PERMISSION_DENIED"), { code: 7 });
  const outer = Object.assign(new Error("retry wrapper"), { errors: [inner] });

  const result = classifyGoogleDocumentAiError(outer);

  assert.equal(result.code, "permission");
});

// --- Credential file diagnostics tests ---

test("classifies credential file missing as authentication error", () => {
  const prev = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  process.env.GOOGLE_APPLICATION_CREDENTIALS = "/nonexistent/fake/credentials.json";

  try {
    const error = new Error("Some random error");
    const result = classifyGoogleDocumentAiError(error);

    assert.equal(result.code, "authentication");
    assert.equal(result.userMessage, "Autentikasi Google Cloud gagal. File credential tidak ditemukan atau tidak bisa dibaca.");
    assert.equal(result.debug?.credentialFilePresent, false);
    assert.equal(result.debug?.credentialFileReadable, false);
  } finally {
    if (prev === undefined) {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    } else {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = prev;
    }
  }
});

test("allows Application Default Credentials when credential file env is not set", () => {
  const prev = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

  try {
    const error = classifyGoogleDocumentAiError(new Error("Unexpected upstream failure"));

    assert.equal(error.code, "google-api");
    assert.ok(!error.debug?.missingEnvKeys?.includes("GOOGLE_APPLICATION_CREDENTIALS"));
  } finally {
    if (prev !== undefined) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = prev;
    }
  }
});

test("debug payload includes processorName", () => {
  const prevProjId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const prevLoc = process.env.GOOGLE_CLOUD_LOCATION;
  const prevProcId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
  const prevCred = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  process.env.GOOGLE_CLOUD_PROJECT_ID = "test-project";
  process.env.GOOGLE_CLOUD_LOCATION = "us";
  process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID = "abc123";
  process.env.GOOGLE_APPLICATION_CREDENTIALS = "/nonexistent/path.json";

  try {
    const error = classifyGoogleDocumentAiError(new Error("test"));

    assert.equal(error.debug?.processorName, "projects/test-project/locations/us/processors/abc123");
  } finally {
    process.env.GOOGLE_CLOUD_PROJECT_ID = prevProjId ?? "";
    process.env.GOOGLE_CLOUD_LOCATION = prevLoc ?? "";
    process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID = prevProcId ?? "";

    if (prevCred === undefined) {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    } else {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = prevCred;
    }
  }
});

test("debug payload includes safe credential project diagnostics", () => {
  const prevProjId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const prevLoc = process.env.GOOGLE_CLOUD_LOCATION;
  const prevProcId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
  const prevCred = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const tempDir = mkdtempSync(join(tmpdir(), "scanhemat-ocr-"));
  const credentialPath = join(tempDir, "credentials.json");

  writeFileSync(
    credentialPath,
    JSON.stringify({
      type: "service_account",
      project_id: "credential-project",
      client_email: "ocr@test-project.iam.gserviceaccount.com",
      private_key: "should-not-be-exposed"
    })
  );

  process.env.GOOGLE_CLOUD_PROJECT_ID = "configured-project";
  process.env.GOOGLE_CLOUD_LOCATION = "us";
  process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID = "abc123";
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialPath;

  try {
    const error = classifyGoogleDocumentAiError(Object.assign(new Error("PERMISSION_DENIED"), { code: 7 }));

    assert.equal(error.debug?.credentialFilePresent, true);
    assert.equal(error.debug?.credentialFileReadable, true);
    assert.equal(error.debug?.credentialClientEmail, "ocr@test-project.iam.gserviceaccount.com");
    assert.equal(error.debug?.credentialProjectId, "credential-project");
    assert.equal(error.debug?.credentialType, "service_account");
    assert.equal(error.debug?.configuredProjectId, "configured-project");
    assert.equal(error.debug?.projectMismatch, true);
    assert.ok(!JSON.stringify(error.debug).includes("should-not-be-exposed"));
  } finally {
    process.env.GOOGLE_CLOUD_PROJECT_ID = prevProjId ?? "";
    process.env.GOOGLE_CLOUD_LOCATION = prevLoc ?? "";
    process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID = prevProcId ?? "";

    if (prevCred === undefined) {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    } else {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = prevCred;
    }

    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("debug payload includes deepError with cause chain", () => {
  const root = Object.assign(new Error("PERMISSION_DENIED"), { code: 7 });
  const outer = Object.assign(new Error("retry wrapper"), { cause: root });

  const result = classifyGoogleDocumentAiError(outer);
  const deepError = result.debug?.deepError as Record<string, unknown> | undefined;

  assert.ok(deepError, "Expected deepError");
  assert.ok(deepError!.cause, "Expected deepError.cause");
});

test("debug message is never 'undefined undefined: undefined'", () => {
  const testErrors = [
    new Error("undefined undefined: undefined"),
    Object.assign(new Error("undefined undefined: undefined"), { code: 16 }),
    Object.assign(new Error("undefined undefined: undefined"), {
      cause: new Error("real error message")
    })
  ];

  for (const error of testErrors) {
    const result = classifyGoogleDocumentAiError(error);

    assert.ok(
      !result.debug?.message?.includes("undefined undefined"),
      `Expected non-garbage debug message, got: ${result.debug?.message}`
    );
  }
});

// --- validateGoogleOcrEnvironment tests ---

test("validateGoogleOcrEnvironment returns env and credential info", () => {
  const result = validateGoogleOcrEnvironment();

  assert.ok(Array.isArray(result.presentEnvKeys));
  assert.ok(Array.isArray(result.missingEnvKeys));
  assert.equal(typeof result.credentialFilePresent, "boolean");
  assert.equal(typeof result.credentialFileReadable, "boolean");
});

test("validateGoogleOcrEnvironment reports processorName when env vars set", () => {
  const prevProjId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const prevLoc = process.env.GOOGLE_CLOUD_LOCATION;
  const prevProcId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;

  process.env.GOOGLE_CLOUD_PROJECT_ID = "my-project";
  process.env.GOOGLE_CLOUD_LOCATION = "eu";
  process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID = "proc-123";

  try {
    const result = validateGoogleOcrEnvironment();
    assert.equal(result.processorName, "projects/my-project/locations/eu/processors/proc-123");
  } finally {
    process.env.GOOGLE_CLOUD_PROJECT_ID = prevProjId ?? "";
    process.env.GOOGLE_CLOUD_LOCATION = prevLoc ?? "";
    process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID = prevProcId ?? "";
  }
});

// --- Non-Error thrown value test ---

test("maps non-Error thrown value", () => {
  const prev = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  process.env.GOOGLE_APPLICATION_CREDENTIALS = "/nonexistent/path.json";

  try {
    const error = classifyGoogleDocumentAiError("raw string error");

    // Credential file check happens first for non-keyword matches
    assert.ok(error.code === "authentication" || error.code === "google-api");
    assert.ok(error.debug?.message);
  } finally {
    if (prev === undefined) {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    } else {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = prev;
    }
  }
});
