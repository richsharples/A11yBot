import type { Evidence } from "../types";

export interface AxeResult {
  ruleId: string;
  impact: string;
  description: string;
  helpUrl: string;
  nodes: number;
  url: string;
}

export async function runAxe(
  url: string,
  headers?: Record<string, string>
): Promise<AxeResult[]> {
  const puppeteer = await import("puppeteer-core");
  const { getChromePath } = await import("chrome-launcher");

  const browser = await puppeteer.default.launch({
    executablePath: getChromePath(),
    args: ["--headless", "--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();

    if (headers && Object.keys(headers).length > 0) {
      await page.setExtraHTTPHeaders(headers);
    }

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Inject axe-core via addScriptTag so it lands in the page's global scope
    // (new Function() creates an isolated scope where CommonJS globals are absent)
    // Use process.cwd() to get the real filesystem path — require.resolve gets webpack-intercepted
    const { join } = await import("path");
    const axePath = join(process.cwd(), "node_modules", "axe-core", "axe.js");
    await page.addScriptTag({ path: axePath });

    const violations = await page.evaluate(async () => {
      const results = await (window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }).axe.run();
      return results.violations;
    });

    return (violations as Array<{
      id: string;
      impact: string;
      description: string;
      helpUrl: string;
      nodes: unknown[];
    }>).map((v) => ({
      ruleId: v.id,
      impact: v.impact ?? "unknown",
      description: v.description,
      helpUrl: v.helpUrl,
      nodes: v.nodes.length,
      url,
    }));
  } finally {
    await browser.close();
  }
}

export function mapAxeToEvidence(
  results: AxeResult[],
  ruleMapping: Record<string, string[]>
): Map<string, Evidence[]> {
  const evidenceMap = new Map<string, Evidence[]>();

  for (const result of results) {
    const criterionIds = ruleMapping[result.ruleId] ?? [];
    for (const criterionId of criterionIds) {
      const existing = evidenceMap.get(criterionId) ?? [];
      existing.push({
        source: "runtime-scan",
        detail: `axe(${result.ruleId})[${result.impact}]: ${result.description} — ${result.nodes} node(s) affected`,
        ref: result.url,
        rawId: result.ruleId,
        capturedAt: new Date().toISOString(),
      });
      evidenceMap.set(criterionId, existing);
    }
  }

  return evidenceMap;
}
