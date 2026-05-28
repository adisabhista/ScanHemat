import type { AiGenerationProvider, AiGenerationProviderName } from "./providers/generation-provider";

type AiGenerationProviderEnv = {
  AI_GENERATION_PROVIDER?: string;
};

export function resolveAiGenerationProviderName(env?: AiGenerationProviderEnv): AiGenerationProviderName {
  const providerValue = env ? env.AI_GENERATION_PROVIDER : process.env.AI_GENERATION_PROVIDER;
  const provider = (providerValue ?? "gemini-api").trim().toLowerCase();

  if (provider === "gemini-api" || provider === "vertex-ai") {
    return provider;
  }

  throw new Error(`Unsupported AI_GENERATION_PROVIDER: ${provider}`);
}

export async function createAiGenerationProvider(name = resolveAiGenerationProviderName()): Promise<AiGenerationProvider> {
  if (name === "vertex-ai") {
    const { VertexAiProvider } = await import("./providers/vertex-ai-provider");
    return new VertexAiProvider();
  }

  const { GeminiApiProvider } = await import("./providers/gemini-api-provider");
  return new GeminiApiProvider();
}
