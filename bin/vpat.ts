#!/usr/bin/env node
import { program } from "commander";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { createRequire } from "module";

const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8")) as { version: string };

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

  const { readUserConfig } = await import("../src/state/user-config");
  const config = readUserConfig();
  const port = parseInt(opts.port ?? process.env.VPAT_PORT ?? String(config.port), 10);
  const openBrowser = opts.browser !== false && config.openBrowser;

  // Seed AI provider from persisted config so settings survive restarts
  if (config.aiDefaults.provider !== "none" && config.aiDefaults.model) {
    const { setProviderConfig } = await import("../src/state/provider");
    setProviderConfig({
      provider: config.aiDefaults.provider,
      model: config.aiDefaults.model,
      apiKey: config.aiDefaults.apiKey,
    });
  }

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
