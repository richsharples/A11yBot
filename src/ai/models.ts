export const OPENROUTER_MODELS = [
  { id: "anthropic/claude-sonnet-4.6",         label: "Claude Sonnet 4.6",        tier: "recommended" as const },
  { id: "openai/gpt-4o",                        label: "GPT-4o",                   tier: "recommended" as const },
  { id: "google/gemini-2.5-flash",              label: "Gemini 2.5 Flash",         tier: "recommended" as const },
  { id: "anthropic/claude-haiku-4.5",           label: "Claude Haiku 4.5 (fast)",  tier: "capable" as const },
  { id: "anthropic/claude-opus-4.6",            label: "Claude Opus 4.6",          tier: "capable" as const },
  { id: "google/gemini-2.5-pro",                label: "Gemini 2.5 Pro",           tier: "capable" as const },
  { id: "meta-llama/llama-3.3-70b-instruct",   label: "Llama 3.3 70B",            tier: "capable" as const },
  { id: "openai/gpt-4o-2024-11-20",            label: "GPT-4o (Nov 2024)",        tier: "capable" as const },
] as const;

export const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6";
