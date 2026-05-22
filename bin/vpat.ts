#!/usr/bin/env node
import { program } from "commander";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";
import { createRequire } from "module";

const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8")) as { version: string };
const CONFIG_DIR = join(homedir(), ".a11ybot");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const DEFAULT_CONFIG = JSON.parse(readFileSync(join(__dirname, "../config/default.json"), "utf-8")) as {
  port: number;
  openBrowser: boolean;
};

interface Config {
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

async function main() {
  program
    .name("a11ybot")
    .version(pkg.version)
    .description("A11yBot — VPAT 2.5 Accessibility Conformance Report generator")
    .option("--port <port>", "Port to listen on")
    .option("--no-browser", "Don't open browser")
    .parse();

  const opts = program.opts<{ port?: string; browser: boolean }>();
  console.log(`\nA11yBot ${pkg.version}`);

  const config = loadConfig();
  const port = parseInt(opts.port ?? process.env.VPAT_PORT ?? String(config.port), 10);
  const openBrowser = opts.browser !== false && config.openBrowser;

  console.log("  Starting server…");

  const { createServer } = await import("http");
  const next = (await import("next")).default;
  const app = next({ dev: false, dir: resolve(__dirname, "..") });
  const handle = app.getRequestHandler();
  await app.prepare();

  const server = createServer((req, res) => handle(req, res));
  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`  ➜ ${url} ${openBrowser ? "(opening browser)" : ""}`);
    console.log(`  ➜ Logs streaming to ./a11ybot-run.log.json`);
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
