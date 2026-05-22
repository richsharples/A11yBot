import pino from "pino";
import { appendFileSync } from "fs";
import { join } from "path";

const logFile = join(process.cwd(), "a11ybot-run.log.json");

export const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: process.env.NODE_ENV === "development"
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
});

declare global {
  // eslint-disable-next-line no-var
  var __vpatApiKey: string | undefined;
}
if (typeof globalThis.__vpatApiKey === "undefined") globalThis.__vpatApiKey = undefined;

let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingEntries: unknown[] = [];

export function writeRunLog(entry: unknown): void {
  pendingEntries.push({ ...(entry as object), ts: new Date().toISOString() });

  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    const lines = pendingEntries.map((e) => JSON.stringify(e)).join("\n") + "\n";
    try {
      appendFileSync(logFile, lines, "utf-8");
    } catch (err) {
      log.error({ err }, "Failed to write run log");
    }
    pendingEntries = [];
    writeTimer = null;
  }, 1000);
}

export function setSessionApiKey(key: string): void {
  globalThis.__vpatApiKey = key;
}

export function getSessionApiKey(): string | undefined {
  return globalThis.__vpatApiKey ?? process.env.ANTHROPIC_API_KEY;
}
