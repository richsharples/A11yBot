import { NextRequest, NextResponse } from "next/server";
import { addEvidence, clearScanEvidence, requireProject, getCriteriaFile } from "@/src/state/project";
import { runLighthouse, mapLighthouseToEvidence } from "@/src/scanners/lighthouse";
import { runAxe, mapAxeToEvidence } from "@/src/scanners/runtime-axe";
import { log, writeRunLog } from "@/src/state/log";
import { RuntimeScanPayloadSchema } from "@/src/types";

// Allow up to 5 minutes for multi-URL runtime scans
export const maxDuration = 300;

function buildLighthouseMapping(edition: "508" | "INT"): Record<string, string[]> {
  const criteriaFile = getCriteriaFile(edition);
  const mapping: Record<string, string[]> = {};
  for (const chapter of criteriaFile.chapters) {
    for (const criterion of chapter.criteria) {
      for (const auditId of criterion.scannerSignals?.lighthouseAudits ?? []) {
        if (!mapping[auditId]) mapping[auditId] = [];
        if (!mapping[auditId].includes(criterion.id)) mapping[auditId].push(criterion.id);
      }
    }
  }
  return mapping;
}

function buildAxeMapping(edition: "508" | "INT"): Record<string, string[]> {
  const criteriaFile = getCriteriaFile(edition);
  const mapping: Record<string, string[]> = {};
  for (const chapter of criteriaFile.chapters) {
    for (const criterion of chapter.criteria) {
      for (const ruleId of criterion.scannerSignals?.axeRules ?? []) {
        if (!mapping[ruleId]) mapping[ruleId] = [];
        if (!mapping[ruleId].includes(criterion.id)) mapping[ruleId].push(criterion.id);
      }
    }
  }
  return mapping;
}

export async function POST(req: NextRequest) {
  try {
    const project = requireProject();
    const body = await req.json();
    const payload = RuntimeScanPayloadSchema.parse(body);

    log.info({ event: "scan.runtime.started", url: payload.url });
    writeRunLog({ event: "scan.runtime.started", url: payload.url, paths: payload.paths });
    const { aiInferredReset } = clearScanEvidence("runtime-scan");

    const lighthouseMapping = buildLighthouseMapping(project.edition);
    const axeMapping = buildAxeMapping(project.edition);
    const paths = payload.paths?.length ? payload.paths : ["/"];
    let totalEvidence = 0;

    for (const path of paths) {
      const fullUrl = path.startsWith("http") ? path : `${payload.url.replace(/\/$/, "")}${path}`;

      // Run Lighthouse and axe in parallel — each launches its own headless Chrome instance
      const [lighthouseResult, axeResult] = await Promise.allSettled([
        runLighthouse(fullUrl, payload.headers),
        runAxe(fullUrl, payload.headers),
      ]);

      if (lighthouseResult.status === "fulfilled") {
        const evidenceMap = mapLighthouseToEvidence(lighthouseResult.value, lighthouseMapping);
        for (const [criterionId, evidences] of evidenceMap) {
          for (const evidence of evidences) { addEvidence(criterionId, evidence); totalEvidence++; }
        }
      } else {
        log.warn({ err: lighthouseResult.reason, url: fullUrl }, "Lighthouse scan failed");
      }

      if (axeResult.status === "fulfilled") {
        const evidenceMap = mapAxeToEvidence(axeResult.value, axeMapping);
        for (const [criterionId, evidences] of evidenceMap) {
          for (const evidence of evidences) { addEvidence(criterionId, evidence); totalEvidence++; }
        }
      } else {
        log.warn({ err: axeResult.reason, url: fullUrl }, "axe scan failed");
      }
    }

    log.info({ event: "scan.runtime.finished", totalEvidence });
    writeRunLog({ event: "scan.runtime.finished", totalEvidence });

    return NextResponse.json({ pathsScanned: paths.length, evidenceAdded: totalEvidence, aiInferredReset });
  } catch (err) {
    log.error({ err }, "Runtime scan failed");
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
