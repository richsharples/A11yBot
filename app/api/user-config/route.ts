import { NextRequest, NextResponse } from "next/server";
import { readUserConfig, writeUserConfig } from "@/src/state/user-config";
import { UserConfigSchema } from "@/src/types";

export async function GET() {
  const config = readUserConfig();
  // Mask API keys — send presence indicator only
  const masked = {
    ...config,
    aiDefaults: {
      ...config.aiDefaults,
      apiKey: config.aiDefaults.apiKey ? "***" : undefined,
      apiKeySet: !!config.aiDefaults.apiKey,
    },
    products: config.products.map((p) => ({
      ...p,
      apiKey: p.apiKey ? "***" : undefined,
      apiKeySet: !!p.apiKey,
    })),
  };
  return NextResponse.json(masked);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const current = readUserConfig();

    // Unmask: if client sends "***" back, preserve the real stored value
    if (body.aiDefaults?.apiKey === "***") {
      body.aiDefaults.apiKey = current.aiDefaults.apiKey;
    }
    if (Array.isArray(body.products)) {
      body.products = body.products.map((p: { apiKey?: string }, i: number) => ({
        ...p,
        apiKey: p.apiKey === "***" ? current.products[i]?.apiKey : p.apiKey,
      }));
    }

    const updated = UserConfigSchema.parse({ ...current, ...body });
    writeUserConfig(updated);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
