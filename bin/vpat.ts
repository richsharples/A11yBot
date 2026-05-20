#!/usr/bin/env node
import { program } from "commander";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";
import readline from "readline";
import { createRequire } from "module";

const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8")) as { version: string };
const CONFIG_DIR = join(homedir(), ".vpat");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const DEFAULT_CONFIG = JSON.parse(readFileSync(join(__dirname, "../config/default.json"), "utf-8")) as {
  model: string;
  port: number;
  openBrowser: boolean;
};

interface Config {
  anthropicApiKey?: string;
  model: string;
  port: number;
  openBrowser: boolean;
}

function loadConfig(): Config {
  const base = { ...DEFAULT_CONFIG };
  if (existsSync(CONFIG_FILE)) {
    try {
      const saved = JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as Partial<Config>;
      return { ...base, ...saved };
    } catch {}
  }
  return base;
}

function saveConfig(config: Config): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  program
    .name("vpat")
    .version(pkg.version)
    .description("VPAT 2.5 Accessibility Conformance Report generator")
    .option("--port <port>", "Port to listen on")
    .option("--no-browser", "Don't open browser")
    .parse();

  const opts = program.opts<{ port?: string; browser: boolean }>();

  console.log(`\nvpat ${pkg.version}`);

  const config = loadConfig();

  // Apply env overrides
  const port = parseInt(opts.port ?? process.env.VPAT_PORT ?? String(config.port), 10);
  const openBrowser = opts.browser !== false && config.openBrowser;

  // Check for API key
  let apiKey = process.env.ANTHROPIC_API_KEY ?? config.anthropicApiKey;
  if (!apiKey) {
    console.log("Reading config:", CONFIG_FILE, existsSync(CONFIG_FILE) ? "" : "(not found — using defaults)");
    console.log("ANTHROPIC_API_KEY: not set");
    const answer = await ask("  ➜ Paste an Anthropic key now, or press Enter to skip and run interview-only:\n> ");
    if (answer && answer.startsWith("sk-")) {
      apiKey = answer;
      config.anthropicApiKey = apiKey;
      saveConfig(config);
      console.log("  Saved to", CONFIG_FILE);
    }
  }

  // Set the API key in the process env so the server picks it up
  if (apiKey) {
    process.env.ANTHROPIC_API_KEY = apiKey;
  }

  console.log("  Starting server...");

  // Start Next.js server
  const { createServer } = await import("http");
  const next = (await import("next")).default;
  const app = next({ dev: false, dir: resolve(__dirname, "..") });
  const handle = app.getRequestHandler();
  await app.prepare();

  const server = createServer((req, res) => handle(req, res));
  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`  ➜ ${url} ${openBrowser ? "(opening browser)" : ""}`);
    console.log(`  ➜ Logs streaming to ./vpat-run.log.json`);
    console.log(`  ➜ Ctrl-C to quit\n`);

    if (openBrowser) {
      import("open").then(({ default: open }) => open(url)).catch(() => {});
    }
  });

  process.on("SIGINT", () => {
    console.log("\nShutting down…");
    server.close(() => process.exit(0));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
