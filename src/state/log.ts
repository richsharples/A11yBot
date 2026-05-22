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

