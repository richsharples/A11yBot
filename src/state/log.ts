import pino from "pino";
import { appendFileSync } from "fs";
import { join } from "path";

const logFile = join(process.cwd(), "a11ybot-run.log.json");

export const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // pino-pretty uses a worker thread and adds ~10-50ms per log call in dev.
  // Plain pino writes JSON to stderr — fast, still readable with pino-pretty piped externally.
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

