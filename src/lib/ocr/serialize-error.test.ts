import assert from "node:assert/strict";
import test from "node:test";

import {
  checkCredentialFile,
  collectDeepErrorText,
  deepSerializeError,
  extractDeepestMessage,
  getNumericField,
  getStringField,
  safeSerializeMetadata,
  serializeError,
  serializeGoogleError
} from "./serialize-error";

// --- getStringField tests ---

test("getStringField returns string value for valid key", () => {
  assert.equal(getStringField({ name: "Error" }, "name"), "Error");
});

test("getStringField returns undefined for missing key", () => {
  assert.equal(getStringField({}, "name"), undefined);
});

test("getStringField returns undefined for non-string value", () => {
  assert.equal(getStringField({ code: 16 }, "code"), undefined);
});

test("getStringField returns undefined for empty string", () => {
  assert.equal(getStringField({ name: "" }, "name"), undefined);
});

test("getStringField returns undefined for non-objects", () => {
  assert.equal(getStringField(null, "name"), undefined);
  assert.equal(getStringField(undefined, "name"), undefined);
  assert.equal(getStringField(42, "name"), undefined);
  assert.equal(getStringField("string", "name"), undefined);
});

// --- getNumericField tests ---

test("getNumericField returns number for valid key", () => {
  assert.equal(getNumericField({ code: 16 }, "code"), 16);
  assert.equal(getNumericField({ code: 0 }, "code"), 0);
});

test("getNumericField returns undefined for NaN", () => {
  assert.equal(getNumericField({ code: NaN }, "code"), undefined);
});

test("getNumericField returns undefined for Infinity", () => {
  assert.equal(getNumericField({ code: Infinity }, "code"), undefined);
});

test("getNumericField returns undefined for missing key", () => {
  assert.equal(getNumericField({}, "code"), undefined);
});

test("getNumericField returns undefined for string value", () => {
  assert.equal(getNumericField({ code: "UNAUTHENTICATED" }, "code"), undefined);
});

test("getNumericField returns undefined for undefined value", () => {
  assert.equal(getNumericField({ code: undefined }, "code"), undefined);
});

test("getNumericField returns undefined for non-objects", () => {
  assert.equal(getNumericField(null, "code"), undefined);
  assert.equal(getNumericField(undefined, "code"), undefined);
});

// --- serializeError tests ---

test("serializeError extracts non-enumerable Error properties", () => {
  const error = new Error("Something went wrong");
  const result = serializeError(error);

  assert.equal(result.name, "Error");
  assert.equal(result.message, "Something went wrong");
  assert.equal(result.code, undefined);
  assert.equal(result.details, undefined);
  assert.equal(result.cause, undefined);
});

test("serializeError extracts gRPC-style code from Error", () => {
  const error = Object.assign(new Error("UNAUTHENTICATED"), { code: 16 });
  const result = serializeError(error);

  assert.equal(result.name, "Error");
  assert.equal(result.message, "UNAUTHENTICATED");
  assert.equal(result.code, 16);
});

test("serializeError extracts string code from Error", () => {
  const error = Object.assign(new Error("PERMISSION_DENIED"), { code: "PERMISSION_DENIED" });
  const result = serializeError(error);

  assert.equal(result.code, "PERMISSION_DENIED");
});

test("serializeError extracts details and reason from Error", () => {
  const error = Object.assign(new Error("Not found"), {
    code: 5,
    details: "Processor not found",
    reason: "NOT_FOUND"
  });
  const result = serializeError(error);

  assert.equal(result.code, 5);
  assert.equal(result.details, "Processor not found");
  assert.equal(result.reason, "NOT_FOUND");
});

test("serializeError extracts nested cause error", () => {
  const cause = new Error("Root cause");
  const error = Object.assign(new Error("Wrapper"), { cause });
  const result = serializeError(error);

  assert.deepEqual(result.cause, {
    name: "Error",
    message: "Root cause"
  });
});

test("serializeError handles non-Error thrown values (string)", () => {
  const result = serializeError("unexpected failure");
  assert.equal(result.message, "unexpected failure");
});

test("serializeError handles non-Error thrown values (number)", () => {
  assert.equal(serializeError(42).message, "42");
});

test("serializeError handles non-Error thrown values (null)", () => {
  assert.equal(serializeError(null).message, "null");
});

test("serializeError handles non-Error thrown values (undefined)", () => {
  assert.equal(serializeError(undefined).message, "undefined");
});

test("serializeError produces JSON.stringify-safe output (never {})", () => {
  const error = new Error("Test error");
  const result = serializeError(error);
  const json = JSON.stringify(result);
  const parsed = JSON.parse(json) as Record<string, unknown>;

  assert.notDeepEqual(parsed, {});
  assert.equal(parsed.name, "Error");
  assert.equal(parsed.message, "Test error");
});

test("serializeError replaces garbage message with cause message", () => {
  const cause = new Error("Could not load the default credentials");
  const error = Object.assign(new Error("undefined undefined: undefined"), { cause });
  const result = serializeError(error);

  assert.equal(result.message, "Could not load the default credentials");
});

test("serializeError returns fallback when all fields are garbage", () => {
  const error = new Error("undefined undefined: undefined");
  const result = serializeError(error);
  assert.ok(!result.message.includes("undefined undefined"), `Got: ${result.message}`);
});

// --- deepSerializeError tests ---

test("deepSerializeError serializes basic Error", () => {
  const error = Object.assign(new Error("test"), { code: 7 });
  const result = deepSerializeError(error);

  assert.equal(result.message, "test");
  assert.equal(result.code, 7);
  assert.equal(result.constructorName, "Error");
});

test("deepSerializeError walks cause chain", () => {
  const root = Object.assign(new Error("PERMISSION_DENIED"), { code: 7 });
  const mid = Object.assign(new Error("retry failed"), { cause: root });
  const outer = Object.assign(new Error("Exception occurred in retry method that was not classified as transient"), { cause: mid });

  const result = deepSerializeError(outer);

  assert.equal(result.message, "Exception occurred in retry method that was not classified as transient");
  assert.ok(result.cause, "Expected cause");
  assert.equal(result.cause!.message, "retry failed");
  assert.ok(result.cause!.cause, "Expected nested cause");
  assert.equal(result.cause!.cause!.message, "PERMISSION_DENIED");
  assert.equal(result.cause!.cause!.code, 7);
});

test("deepSerializeError includes errors array", () => {
  const inner = Object.assign(new Error("NOT_FOUND"), { code: 5 });
  const outer = Object.assign(new Error("wrapper"), { errors: [inner] });

  const result = deepSerializeError(outer);

  assert.ok(result.errors, "Expected errors array");
  assert.equal(result.errors!.length, 1);
  assert.equal(result.errors![0].message, "NOT_FOUND");
  assert.equal(result.errors![0].code, 5);
});

test("deepSerializeError respects maxDepth", () => {
  const deep = Object.assign(new Error("level4"), {
    cause: Object.assign(new Error("level3"), {
      cause: Object.assign(new Error("level2"), {
        cause: Object.assign(new Error("level1"), {
          cause: new Error("level0")
        })
      })
    })
  });

  const result = deepSerializeError(deep, 2);

  assert.ok(result.cause, "Expected level 1 cause");
  // At depth 2, we get a minimal node (message only, no further cause)
  assert.ok(result.cause!.cause, "Expected level 2 minimal node");
  assert.equal(result.cause!.cause!.message, "level2");
  assert.equal(result.cause!.cause!.cause, undefined, "Should not go deeper than maxDepth");
});

test("deepSerializeError handles non-Error values", () => {
  const result = deepSerializeError("just a string");
  assert.equal(result.message, "just a string");
});

test("deepSerializeError includes ownPropertyNames", () => {
  const error = Object.assign(new Error("test"), { code: 16, details: "info" });
  const result = deepSerializeError(error);

  assert.ok(result.ownPropertyNames, "Expected ownPropertyNames");
  assert.ok(result.ownPropertyNames!.includes("code"));
});

// --- collectDeepErrorText tests ---

test("collectDeepErrorText collects text from simple error", () => {
  const error = Object.assign(new Error("PERMISSION_DENIED"), { code: 7 });
  const text = collectDeepErrorText(error);

  assert.ok(text.includes("permission_denied"));
  assert.ok(text.includes("7"));
});

test("collectDeepErrorText collects text from nested cause chain", () => {
  const root = new Error("Could not load the default credentials");
  const mid = Object.assign(new Error("retry wrapper"), { cause: root });
  const outer = Object.assign(new Error("Exception occurred in retry"), { cause: mid });

  const text = collectDeepErrorText(outer);

  assert.ok(text.includes("could not load the default credentials"));
  assert.ok(text.includes("retry wrapper"));
});

test("collectDeepErrorText collects text from errors array", () => {
  const inner = Object.assign(new Error("NOT_FOUND: Processor not found"), { code: 5 });
  const outer = Object.assign(new Error("retry failed"), { errors: [inner] });

  const text = collectDeepErrorText(outer);

  assert.ok(text.includes("not_found"));
  assert.ok(text.includes("processor not found"));
  assert.ok(text.includes("5"));
});

test("collectDeepErrorText includes note field", () => {
  const error = Object.assign(new Error("error"), {
    note: "Exception occurred in retry method that was not classified as transient"
  });

  const text = collectDeepErrorText(error);

  assert.ok(text.includes("exception occurred in retry"));
});

// --- extractDeepestMessage tests ---

test("extractDeepestMessage returns deepest non-garbage message", () => {
  const root = new Error("PERMISSION_DENIED: Access denied");
  const mid = Object.assign(new Error("undefined undefined: undefined"), { cause: root });
  const outer = Object.assign(new Error("Exception occurred in retry"), { cause: mid });

  assert.equal(extractDeepestMessage(outer), "PERMISSION_DENIED: Access denied");
});

test("extractDeepestMessage walks errors array when no cause", () => {
  const inner = new Error("NOT_FOUND: Processor not found");
  const outer = Object.assign(new Error("retry wrapper"), { errors: [inner] });

  assert.equal(extractDeepestMessage(outer), "NOT_FOUND: Processor not found");
});

test("extractDeepestMessage returns Unknown error for all-garbage chain", () => {
  const error = Object.assign(new Error("undefined undefined: undefined"), {
    cause: new Error("undefined undefined: undefined")
  });

  assert.equal(extractDeepestMessage(error), "Unknown error");
});

test("extractDeepestMessage handles non-Error values", () => {
  assert.equal(extractDeepestMessage("string error"), "Unknown error");
});

// --- checkCredentialFile tests ---

test("checkCredentialFile reports missing when env var not set", () => {
  const prev = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

  try {
    const result = checkCredentialFile();

    assert.equal(result.credentialFilePresent, false);
    assert.equal(result.credentialFileReadable, false);
    assert.ok(result.credentialError);
  } finally {
    if (prev !== undefined) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = prev;
    }
  }
});

test("checkCredentialFile reports file not found for nonexistent path", () => {
  const prev = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  process.env.GOOGLE_APPLICATION_CREDENTIALS = "/nonexistent/path/to/credentials.json";

  try {
    const result = checkCredentialFile();

    assert.equal(result.credentialFilePresent, false);
    assert.equal(result.credentialFileReadable, false);
    assert.ok(result.credentialError?.includes("not found") || result.credentialError?.includes("File not found"));
  } finally {
    if (prev === undefined) {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    } else {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = prev;
    }
  }
});

// --- safeSerializeMetadata tests ---

test("safeSerializeMetadata returns undefined for null/undefined", () => {
  assert.equal(safeSerializeMetadata(null), undefined);
  assert.equal(safeSerializeMetadata(undefined), undefined);
});

test("safeSerializeMetadata serializes plain objects", () => {
  assert.deepEqual(safeSerializeMetadata({ key: "value" }), { key: "value" });
});

test("safeSerializeMetadata returns undefined for empty objects", () => {
  assert.equal(safeSerializeMetadata({}), undefined);
});

test("safeSerializeMetadata handles gRPC getMap", () => {
  const fake = { getMap: () => ({ "x-request-id": "abc" }) };
  assert.deepEqual(safeSerializeMetadata(fake), { "x-request-id": "abc" });
});

test("safeSerializeMetadata handles circular references", () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.equal(safeSerializeMetadata(circular), undefined);
});

// --- serializeGoogleError tests ---

test("serializeGoogleError extracts status field", () => {
  const error = Object.assign(new Error("test"), { status: "UNAUTHENTICATED" });
  assert.equal(serializeGoogleError(error).status, "UNAUTHENTICATED");
});
