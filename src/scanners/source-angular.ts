import { readFileSync } from "fs";
import type { Evidence } from "../types";
import type { RuleMapping } from "./source-jsx";

// Angular template scanning uses regex heuristics only (documented v1 limitation)
interface RegexRule {
  id: string;
  pattern: RegExp;
  message: string;
}

const RULES: RegexRule[] = [
  {
    id: "image-alt",
    pattern: /<img(?![^>]*\balt=)[^>]*>/gi,
    message: "Angular template: <img> missing alt attribute",
  },
  {
    id: "button-name",
    pattern: /<button(?![^>]*(?:aria-label|aria-labelledby|title)=)[^>]*>\s*<\/button>/gi,
    message: "Angular template: empty <button> with no accessible name",
  },
  {
    id: "label",
    pattern: /<input(?![^>]*(?:aria-label|aria-labelledby|title)=)[^>]*>/gi,
    message: "Angular template: <input> may lack accessible label (regex heuristic — verify manually)",
  },
];

export function scanAngularFile(
  filePath: string,
  ruleMapping: RuleMapping
): Map<string, Evidence[]> {
  const source = readFileSync(filePath, "utf-8");
  const evidenceMap = new Map<string, Evidence[]>();

  for (const rule of RULES) {
    const matches = [...source.matchAll(rule.pattern)];
    if (matches.length === 0) continue;

    const criterionIds = ruleMapping[rule.id] ?? [];
    for (const criterionId of criterionIds) {
      const existing = evidenceMap.get(criterionId) ?? [];
      for (const match of matches) {
        const lineNumber = source.slice(0, match.index ?? 0).split("\n").length;
        existing.push({
          source: "source-scan",
          detail: `Angular(${rule.id}): ${rule.message}`,
          ref: `${filePath}:${lineNumber}`,
          rawId: rule.id,
          capturedAt: new Date().toISOString(),
        });
      }
      evidenceMap.set(criterionId, existing);
    }
  }

  return evidenceMap;
}
