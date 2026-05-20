import Anthropic from "@anthropic-ai/sdk";
import { getSessionApiKey } from "../state/log";

let _client: Anthropic | null = null;

export function getClient(): Anthropic {
  const apiKey = getSessionApiKey();
  if (!apiKey) {
    throw new Error("No Anthropic API key configured. Set ANTHROPIC_API_KEY or pass a key on first run.");
  }
  // Re-create if key changed
  if (!_client) {
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export function resetClient(): void {
  _client = null;
}
