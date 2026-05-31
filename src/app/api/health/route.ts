import { NextResponse } from "next/server";

import { validateProductionEnvironment } from "@/lib/config/environment";
import { checkHealth } from "@/lib/health/check-health";
import { prisma } from "@/lib/prisma";
import { getReceiptStorage } from "@/lib/storage/storage-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    try {
      validateProductionEnvironment();
    } catch {
      return NextResponse.json(
        {
          status: "degraded",
          version: getVersion(),
          timestamp: new Date().toISOString(),
          checks: {
            database: "unknown",
            storage: "unknown",
            configuration: "error"
          }
        },
        { status: 503 }
      );
    }
  }

  const { checks, healthy } = await checkHealth({
    checkDatabase: async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
    checkStorage: async () => {
      await getReceiptStorage().healthCheck();
    }
  });

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      version: getVersion(),
      timestamp: new Date().toISOString(),
      checks
    },
    { status: healthy ? 200 : 503 }
  );
}

function getVersion() {
  return process.env.APP_VERSION?.trim() || process.env.npm_package_version || "unknown";
}
