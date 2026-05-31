import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";

const hourMs = 60 * 60 * 1000;

const policies = {
  receiptUpload: { limit: 20, message: "Batas unggah struk tercapai. Coba lagi nanti." },
  assistantChat: { limit: 60, message: "Batas penggunaan Asisten Hemat tercapai. Coba lagi nanti." },
  visionVerify: { limit: 20, message: "Batas analisis AI Visual tercapai. Coba lagi nanti." }
} as const;

export type RateLimitPolicyName = keyof typeof policies;

export function enforceUserRateLimit(policyName: RateLimitPolicyName, userId: string) {
  const policy = policies[policyName];
  const result = checkRateLimit({
    key: `${policyName}:${userId}`,
    limit: policy.limit,
    windowMs: hourMs
  });

  if (result.allowed) {
    return undefined;
  }

  return NextResponse.json(
    { error: policy.message },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)))
      }
    }
  );
}
