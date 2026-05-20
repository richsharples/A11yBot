import type { Evidence } from "../types";

export interface LighthouseResult {
  auditId: string;
  score: number | null;
  description: string;
  details?: string;
  url: string;
}

export async function runLighthouse(
  url: string,
  headers?: Record<string, string>
): Promise<LighthouseResult[]> {
  // Dynamic import to avoid issues with Next.js bundling
  const { default: lighthouse } = await import("lighthouse");
  const chromeLauncher = await import("chrome-launcher");

  const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless", "--no-sandbox"] });

  const opts = {
    port: chrome.port,
    onlyCategories: ["accessibility"],
    extraHeaders: headers ?? {},
  };

  try {
    const runnerResult = await lighthouse(url, opts);
    if (!runnerResult?.lhr) return [];

    const { audits } = runnerResult.lhr;
    const results: LighthouseResult[] = [];

    for (const [auditId, audit] of Object.entries(audits)) {
      // Only include failed or n/a audits (score < 1 or score === null for informational)
      if (audit.score === 1) continue;
      if (audit.scoreDisplayMode === "notApplicable") continue;

      results.push({
        auditId,
        score: audit.score,
        description: audit.description ?? auditId,
        details: audit.explanation ?? audit.details?.type,
        url,
      });
    }

    return results;
  } finally {
    await chrome.kill();
  }
}

export function mapLighthouseToEvidence(
  results: LighthouseResult[],
  ruleMapping: Record<string, string[]>
): Map<string, Evidence[]> {
  const evidenceMap = new Map<string, Evidence[]>();

  for (const result of results) {
    const criterionIds = ruleMapping[result.auditId] ?? [];
    for (const criterionId of criterionIds) {
      const existing = evidenceMap.get(criterionId) ?? [];
      existing.push({
        source: "runtime-scan",
        detail: `Lighthouse(${result.auditId}): ${result.description}${result.details ? ` — ${result.details}` : ""}`,
        ref: result.url,
        rawId: result.auditId,
        capturedAt: new Date().toISOString(),
      });
      evidenceMap.set(criterionId, existing);
    }
  }

  return evidenceMap;
}
