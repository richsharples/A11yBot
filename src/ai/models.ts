export const OPENROUTER_MODELS = [
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", tier: "recommended" as const },
  { id: "openai/gpt-4o",               label: "GPT-4o",             tier: "recommended" as const },
  { id: "google/gemini-flash-1.5",     label: "Gemini 1.5 Flash",   tier: "recommended" as const },
  { id: "anthropic/claude-3-haiku",    label: "Claude 3 Haiku (fast)", tier: "capable" as const },
  { id: "openai/gpt-4o-mini",          label: "GPT-4o mini (fast)", tier: "capable" as const },
  { id: "google/gemini-pro-1.5",       label: "Gemini 1.5 Pro",     tier: "capable" as const },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", tier: "capable" as const },
  { id: "mistralai/mistral-large",     label: "Mistral Large",      tier: "capable" as const },
] as const;

export const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-3.5-sonnet";
