import { NextRequest, NextResponse } from "next/server";
import { addEvidence, clearScanEvidence, requireProject, getCriteriaFile } from "@/src/state/project";
import { runLighthouse, mapLighthouseToEvidence } from "@/src/scanners/lighthouse";
import { log, writeRunLog } from "@/src/state/log";
import { RuntimeScanPayloadSchema } from "@/src/types";

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

export async function POST(req: NextRequest) {
  try {
    const project = requireProject();
    const body = await req.json();
    const payload = RuntimeScanPayloadSchema.parse(body);

    log.info({ event: "scan.runtime.started", url: payload.url });
    writeRunLog({ event: "scan.runtime.started", url: payload.url, paths: payload.paths });
    clearScanEvidence("runtime-scan");

    const mapping = buildLighthouseMapping(project.edition);
    const paths = payload.paths?.length ? payload.paths : ["/"];
    let totalEvidence = 0;

    for (const path of paths) {
      const fullUrl = path.startsWith("http") ? path : `${payload.url.replace(/\/$/, "")}${path}`;
      try {
        const results = await runLighthouse(fullUrl, payload.headers);
        const evidenceMap = mapLighthouseToEvidence(results, mapping);
        for (const [criterionId, evidences] of evidenceMap) {
          for (const evidence of evidences) {
            addEvidence(criterionId, evidence);
            totalEvidence++;
          }
        }
      } catch (err) {
        log.warn({ err, url: fullUrl }, "Lighthouse scan failed for URL");
      }
    }

    log.info({ event: "scan.runtime.finished", totalEvidence });
    writeRunLog({ event: "scan.runtime.finished", totalEvidence });

    return NextResponse.json({ pathsScanned: paths.length, evidenceAdded: totalEvidence });
  } catch (err) {
    log.error({ err }, "Runtime scan failed");
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
