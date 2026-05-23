import { getProviderConfig } from "../state/provider";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const OLLAMA_BASE = "http://localhost:11434/v1";

export async function callLLM(systemPrompt: string, userContent: string): Promise<string> {
  const config = getProviderConfig();

  if (config.provider === "none" || !config.model) {
    throw new Error("No AI provider configured. Open Settings to set up OpenRouter or Ollama.");
  }

  const baseUrl = config.provider === "ollama" ? OLLAMA_BASE : OPENROUTER_BASE;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (config.provider === "openrouter") {
    if (!config.apiKey) throw new Error("OpenRouter API key not set. Open Settings to add one.");
    headers["Authorization"] = `Bearer ${config.apiKey}`;
    headers["HTTP-Referer"] = "https://github.com/richsharples/A11yBot";
    headers["X-Title"] = "A11yBot";
  }

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: 1024,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  };

  // Force JSON output mode — Ollama supports this since v0.1.9; prevents small
  // models from returning Python-style None or unquoted strings.
  if (config.provider === "ollama") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`LLM API error ${res.status}: ${body}`);
  }

  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content;
}
