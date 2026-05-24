import { NextRequest, NextResponse } from "next/server";
import { getProviderConfig, setProviderConfig } from "@/src/state/provider";
import type { ProviderConfig } from "@/src/state/provider";

async function detectOllama(): Promise<{ available: boolean; models: string[] }> {
  try {
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return { available: false, models: [] };
    const data = await res.json() as { models: { name: string }[] };
    return { available: true, models: data.models.map((m) => m.name) };
  } catch {
    return { available: false, models: [] };
  }
}

export async function GET() {
  const [ollama, current] = await Promise.all([
    detectOllama(),
    Promise.resolve(getProviderConfig()),
  ]);
  return NextResponse.json({
    current: { ...current, apiKey: current.apiKey ? "***" : undefined },
    ollama,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as ProviderConfig;
  setProviderConfig(body);
  return NextResponse.json({ ok: true });
}
