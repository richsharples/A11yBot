import { NextRequest, NextResponse } from "next/server";
import fg from "fast-glob";
import { addEvidence, requireProject, getCriteriaFile } from "@/src/state/project";
import { scanHtmlFile } from "@/src/scanners/source-html";
import { scanVueFile } from "@/src/scanners/source-vue";
import { scanAngularFile } from "@/src/scanners/source-angular";
import { scanCssFile, buildCssEvidence } from "@/src/scanners/source-css";
import { log, writeRunLog } from "@/src/state/log";
import type { RuleMapping } from "@/src/scanners/source-jsx";

function buildRuleMapping(edition: "508" | "INT"): RuleMapping {
  const criteriaFile = getCriteriaFile(edition);
  const mapping: RuleMapping = {};
  for (const chapter of criteriaFile.chapters) {
    for (const criterion of chapter.criteria) {
      const signals = criterion.scannerSignals;
      if (!signals) continue;
      const allRules = [
        ...(signals.eslintRules ?? []),
        ...(signals.axeRules ?? []),
        ...(signals.lighthouseAudits ?? []),
      ];
      for (const rule of allRules) {
        // Strip "jsx-a11y/" prefix for unified mapping
        const key = rule.replace(/^jsx-a11y\//, "");
        if (!mapping[key]) mapping[key] = [];
        if (!mapping[key].includes(criterion.id)) mapping[key].push(criterion.id);
        // Also store with prefix
        if (!mapping[rule]) mapping[rule] = [];
        if (!mapping[rule].includes(criterion.id)) mapping[rule].push(criterion.id);
      }
    }
  }
  return mapping;
}

export async function POST(req: NextRequest) {
  try {
    const project = requireProject();
    const { sourcePath } = await req.json() as { sourcePath: string };

    if (!sourcePath) return NextResponse.json({ error: "sourcePath required" }, { status: 400 });

    log.info({ event: "scan.source.started", sourcePath });
    writeRunLog({ event: "scan.source.started", sourcePath });

    const ruleMapping = buildRuleMapping(project.edition);
    const evidenceTotals: Record<string, number> = {};

    // Glob files
    const htmlFiles = await fg(["**/*.html"], { cwd: sourcePath, ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"], absolute: true });
    const vueFiles = await fg(["**/*.vue"], { cwd: sourcePath, ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"], absolute: true });
    const angularFiles = await fg(["**/*.component.html", "**/*.template.html"], { cwd: sourcePath, ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"], absolute: true });
    const cssFiles = await fg(["**/*.css", "**/*.scss"], { cwd: sourcePath, ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"], absolute: true });
    const jsxFiles = await fg(["**/*.{jsx,tsx}"], { cwd: sourcePath, ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"], absolute: true });

    const mergeEvidence = (evidenceMap: Map<string, import("@/src/types").Evidence[]>) => {
      for (const [criterionId, evidences] of evidenceMap) {
        for (const evidence of evidences) {
          addEvidence(criterionId, evidence);
          evidenceTotals[criterionId] = (evidenceTotals[criterionId] ?? 0) + 1;
        }
      }
    };

    // HTML
    for (const file of htmlFiles) {
      mergeEvidence(scanHtmlFile(file, ruleMapping));
    }

    // Vue
    for (const file of vueFiles) {
      mergeEvidence(scanVueFile(file, ruleMapping));
    }

    // Angular
    for (const file of angularFiles) {
      mergeEvidence(scanAngularFile(file, ruleMapping));
    }

    // CSS
    for (const file of cssFiles) {
      const issues = scanCssFile(file);
      mergeEvidence(buildCssEvidence(file, issues, ruleMapping));
    }

    // JSX/TSX — run eslint programmatically
    if (jsxFiles.length > 0) {
      try {
        const { scanJsx } = await import("@/src/scanners/source-jsx");
        mergeEvidence(await scanJsx(jsxFiles, ruleMapping));
      } catch (err) {
        log.warn({ err }, "JSX/TSX eslint scan failed (non-fatal)");
      }
    }

    const totalEvidence = Object.values(evidenceTotals).reduce((a, b) => a + b, 0);
    log.info({ event: "scan.source.finished", totalEvidence });
    writeRunLog({ event: "scan.source.finished", totalEvidence, evidenceTotals });

    return NextResponse.json({
      scanned: { html: htmlFiles.length, vue: vueFiles.length, angular: angularFiles.length, css: cssFiles.length, jsx: jsxFiles.length },
      evidenceAdded: totalEvidence,
      criteriaWithEvidence: Object.keys(evidenceTotals).length,
    });
  } catch (err) {
    log.error({ err }, "Source scan failed");
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
