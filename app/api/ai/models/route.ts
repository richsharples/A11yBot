import { NextRequest, NextResponse } from "next/server";
import { getProviderConfig } from "@/src/state/provider";
import { OPENROUTER_MODELS } from "@/src/ai/models";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const MIN_CONTEXT = 32768;
const TODAY = new Date();

interface RawModel {
  id: string;
  name: string;
  context_length: number;
  architecture: { modality: string; input_modalities: string[] };
  pricing: { prompt: string; completion: string };
  expiration_date: string | null;
}

export interface OpenRouterModelInfo {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
}

function isUsable(m: RawModel): boolean {
  if (!m.architecture.modality.endsWith("->text")) return false;
  if (m.context_length < MIN_CONTEXT) return false;
  if (m.expiration_date && new Date(m.expiration_date) <= TODAY) return false;
  return true;
}

const FALLBACK: OpenRouterModelInfo[] = OPENROUTER_MODELS.map((m) => ({
  id: m.id,
  name: m.label,
  context_length: 0,
  pricing: { prompt: "0", completion: "0" },
}));

export async function GET(req: NextRequest) {
  const keyParam = req.nextUrl.searchParams.get("key");
  const stored = getProviderConfig();
  const apiKey = keyParam || stored.apiKey;

  if (!apiKey) {
    return NextResponse.json({ models: FALLBACK, source: "fallback" });
  }

  try {
    const res = await fetch(`${OPENROUTER_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`${res.status}`);

    const data = await res.json() as { data: RawModel[] };
    const models: OpenRouterModelInfo[] = data.data
      .filter(isUsable)
      .map((m) => ({
        id: m.id,
        name: m.name,
        context_length: m.context_length,
        pricing: { prompt: m.pricing.prompt, completion: m.pricing.completion },
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ models, source: "live" });
  } catch {
    return NextResponse.json({ models: FALLBACK, source: "fallback" });
  }
}
