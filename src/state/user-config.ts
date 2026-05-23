import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { UserConfigSchema, type UserConfig } from "../types";

const CONFIG_DIR = join(homedir(), ".a11ybot");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export function readUserConfig(): UserConfig {
  if (!existsSync(CONFIG_FILE)) {
    return UserConfigSchema.parse({});
  }
  try {
    const raw = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    return UserConfigSchema.parse(raw);
  } catch {
    return UserConfigSchema.parse({});
  }
}

export function writeUserConfig(config: UserConfig): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

// Resolve the API key for a given project: product key → aiDefaults key → env var
export function resolveApiKey(config: UserConfig, productIndex?: number): string | undefined {
  if (productIndex !== undefined) {
    const product = config.products[productIndex];
    if (product?.apiKey) return product.apiKey;
  }
  if (config.aiDefaults.apiKey) return config.aiDefaults.apiKey;
  return process.env.ANTHROPIC_API_KEY;
}
