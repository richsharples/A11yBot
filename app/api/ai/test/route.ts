import { NextRequest, NextResponse } from "next/server";
import type { ProviderConfig } from "@/src/state/provider";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const OLLAMA_BASE = "http://localhost:11434/v1";

export async function POST(req: NextRequest) {
  const config = await req.json() as ProviderConfig;

  if (config.provider === "none" || !config.model) {
    return NextResponse.json({ success: false, error: "No provider or model selected." });
  }

  const baseUrl = config.provider === "ollama" ? OLLAMA_BASE : OPENROUTER_BASE;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (config.provider === "openrouter") {
    if (!config.apiKey) return NextResponse.json({ success: false, error: "API key required." });
    headers["Authorization"] = `Bearer ${config.apiKey}`;
    headers["HTTP-Referer"] = "https://github.com/richsharples/A11yBot";
    headers["X-Title"] = "A11yBot";
  }

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        model: config.model,
        max_tokens: 5,
        messages: [{ role: "user", content: "Reply with the single word: ready" }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      return NextResponse.json({ success: false, error: `API error ${res.status}: ${body}` });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) });
  }
}
