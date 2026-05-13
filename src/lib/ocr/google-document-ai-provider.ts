import { DocumentProcessorServiceClient } from "@google-cloud/documentai";

import type { OcrInput, OcrProvider, OcrResult } from "@/lib/ocr/ocr-provider";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for Google Document AI OCR.`);
  }

  return value;
}

export class GoogleDocumentAiOcrProvider implements OcrProvider {
  name = "google-document-ai" as const;

  async extractText(input: OcrInput): Promise<OcrResult> {
    const projectId = requireEnv("GOOGLE_CLOUD_PROJECT_ID");
    const location = requireEnv("GOOGLE_CLOUD_LOCATION");
    const processorId = requireEnv("GOOGLE_DOCUMENT_AI_PROCESSOR_ID");
    const client = new DocumentProcessorServiceClient({
      apiEndpoint: `${location}-documentai.googleapis.com`
    });
    const processorName = client.processorPath(projectId, location, processorId);
    const [result] = await client.processDocument({
      name: processorName,
      rawDocument: {
        content: input.content.toString("base64"),
        mimeType: input.mimeType
      }
    });

    return {
      rawText: result.document?.text?.trim() ?? ""
    };
  }
}
