import { readFileSync } from "fs";
import type { Evidence } from "../types";

// Lightweight CSS scanner — detect patterns that hide focus indicators
// Full contrast analysis requires a runtime scanner; document this limitation.
interface CssIssue {
  ruleId: string;
  message: string;
  lineNumber: number;
}

export function scanCssFile(filePath: string): CssIssue[] {
  const source = readFileSync(filePath, "utf-8");
  const lines = source.split("\n");
  const issues: CssIssue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // outline: none / outline: 0 without :focus-visible guard
    if (/outline\s*:\s*(?:none|0\b)/.test(line) && !lines.slice(Math.max(0, i - 5), i).join("").includes(":focus")) {
      issues.push({
        ruleId: "focus-visible",
        message: `CSS: 'outline: none/0' may suppress focus indicator`,
        lineNumber: lineNum,
      });
    }

    // visibility: hidden or display: none on :focus
    if (/visibility\s*:\s*hidden|display\s*:\s*none/.test(line)) {
      const context = lines.slice(Math.max(0, i - 3), i).join(" ");
      if (/:focus/.test(context)) {
        issues.push({
          ruleId: "focus-visible",
          message: `CSS: focus state may be hidden`,
          lineNumber: lineNum,
        });
      }
    }
  }

  return issues;
}

export function buildCssEvidence(
  filePath: string,
  issues: CssIssue[],
  ruleMapping: Record<string, string[]>
): Map<string, Evidence[]> {
  const evidenceMap = new Map<string, Evidence[]>();
  for (const issue of issues) {
    const criterionIds = ruleMapping[issue.ruleId] ?? [];
    for (const criterionId of criterionIds) {
      const existing = evidenceMap.get(criterionId) ?? [];
      existing.push({
        source: "source-scan",
        detail: `CSS(${issue.ruleId}): ${issue.message}`,
        ref: `${filePath}:${issue.lineNumber}`,
        rawId: issue.ruleId,
        capturedAt: new Date().toISOString(),
      });
      evidenceMap.set(criterionId, existing);
    }
  }
  return evidenceMap;
}
