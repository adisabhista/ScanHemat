import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { existsSync, readFileSync } from "node:fs";
import util from "node:util";
import path from "node:path";

function runDiagnostics() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim();
  const location = process.env.GOOGLE_CLOUD_LOCATION?.trim();
  const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID?.trim();
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

  console.log("=== Environment Verification ===");
  console.log(`GOOGLE_CLOUD_PROJECT_ID: ${projectId ? "present" : "MISSING"}`);
  console.log(`GOOGLE_CLOUD_LOCATION: ${location ? "present" : "MISSING"}`);
  console.log(`GOOGLE_DOCUMENT_AI_PROCESSOR_ID: ${processorId ? "present" : "MISSING"}`);
  console.log(`GOOGLE_APPLICATION_CREDENTIALS: ${credentialPath ? "present" : "MISSING"}`);

  if (credentialPath) {
    const exists = existsSync(credentialPath);
    console.log(`Credential file exists: ${exists}`);
    
    if (exists) {
      try {
        const content = readFileSync(credentialPath, "utf-8");
        const parsed = JSON.parse(content);
        console.log(`Credential JSON type: ${parsed.type}`);
        console.log(`Credential JSON project_id: ${parsed.project_id}`);
        console.log(`Credential JSON client_email: ${parsed.client_email}`);
      } catch (e) {
        console.log(`Credential JSON error: ${(e as Error).message}`);
      }
    }
  }

  if (!projectId || !location || !processorId) {
    console.error("Missing required environment variables. Cannot proceed.");
    process.exit(1);
  }

  const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;
  console.log(`\nProcessor resource name: ${processorName}`);

  return { projectId, location, processorId, processorName };
}

async function main() {
  const { location, processorName } = runDiagnostics();

  const filePath = process.argv[2];
  if (!filePath) {
    console.error("\nUsage: npm run ocr:diagnose -- <path-to-file>");
    process.exit(1);
  }

  if (!existsSync(filePath)) {
    console.error(`\nFile not found: ${filePath}`);
    process.exit(1);
  }

  const ext = path.extname(filePath).toLowerCase();
  let mimeType = "application/pdf";
  if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
  else if (ext === ".png") mimeType = "image/png";
  else if (ext === ".webp") mimeType = "image/webp";

  console.log(`\nReading file: ${filePath}`);
  console.log(`Detected MIME type: ${mimeType}`);

  const fileBuffer = readFileSync(filePath);

  console.log("\n=== Calling Document AI ===");
  const apiEndpoint = location === "eu"
    ? "eu-documentai.googleapis.com"
    : location === "us"
      ? "us-documentai.googleapis.com"
      : `${location}-documentai.googleapis.com`;

  console.log(`API Endpoint: ${apiEndpoint}`);

  const client = new DocumentProcessorServiceClient({
    apiEndpoint,
  });

  const request = {
    name: processorName,
    rawDocument: {
      content: fileBuffer.toString("base64"),
      mimeType,
    },
  };

  try {
    console.log("Sending processDocument request...");
    const [result] = await client.processDocument(request);
    
    const document = result.document;
    if (!document) {
      console.log("Success, but no document returned.");
      return;
    }

    const text = document.text || "";
    console.log("\n=== Success ===");
    console.log(`Text length: ${text.length} characters`);
    console.log(`Page count: ${document.pages?.length || 0}`);
    console.log("\nFirst 1000 characters:");
    console.log("------------------------");
    console.log(text.substring(0, 1000));
    console.log("------------------------");

  } catch (error) {
    console.error("\n=== Error ===");
    console.error(util.inspect(error, { depth: 10, colors: true, showHidden: true }));
    
    if (error instanceof Error) {
      const err = error as Error & Record<string, unknown>;
      console.error("\n--- Extracted Fields ---");
      console.error(`Constructor name: ${error.constructor?.name}`);
      console.error(`Name: ${error.name}`);
      console.error(`Message: ${error.message}`);
      console.error(`Code: ${err.code}`);
      console.error(`Details: ${err.details}`);
      console.error(`Reason: ${err.reason}`);
      console.error(`Status: ${err.status}`);
      console.error("Metadata:", err.metadata);
      
      if (err.cause) {
        console.error("\n--- Cause Chain ---");
        let current: unknown = err.cause;
        let depth = 1;
        while (current instanceof Error) {
          const cerr = current as Error & Record<string, unknown>;
          console.error(`[Depth ${depth}] ${current.name}: ${current.message}`);
          console.error(`[Depth ${depth}] Code: ${cerr.code}`);
          if (cerr.cause) {
            current = cerr.cause;
            depth++;
          } else {
            break;
          }
        }
      }
    }
  }
}

main().catch(console.error);
