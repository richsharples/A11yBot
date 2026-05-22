export interface ProviderConfig {
  provider: "openrouter" | "ollama" | "none";
  apiKey?: string;
  model: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __a11ybotProvider: ProviderConfig;
}
if (typeof globalThis.__a11ybotProvider === "undefined") {
  globalThis.__a11ybotProvider = { provider: "none", model: "" };
}

export function getProviderConfig(): ProviderConfig {
  return globalThis.__a11ybotProvider;
}

export function setProviderConfig(config: ProviderConfig): void {
  globalThis.__a11ybotProvider = config;
}
