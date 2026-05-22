import type { Edition } from "../types";
import { getCriteriaFile } from "../state/project";

export type RuleMapping = Record<string, string[]>;

export function buildRuleMapping(edition: Edition): RuleMapping {
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
        const key = rule.replace(/^jsx-a11y\//, "");
        if (!mapping[key]) mapping[key] = [];
        if (!mapping[key].includes(criterion.id)) mapping[key].push(criterion.id);
        if (!mapping[rule]) mapping[rule] = [];
        if (!mapping[rule].includes(criterion.id)) mapping[rule].push(criterion.id);
      }
    }
  }
  return mapping;
}
