import { ESLint } from "eslint";
import type { Evidence } from "../types";

// Map eslint rule id → criterion ids (via scannerSignals in criteria JSON)
// Built dynamically from the criteria file by the caller
export type RuleMapping = Record<string, string[]>;

export async function scanJsx(
  filePaths: string[],
  ruleMapping: RuleMapping
): Promise<Map<string, Evidence[]>> {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: {
      plugins: { "jsx-a11y": require("eslint-plugin-jsx-a11y") },
      rules: Object.fromEntries(
        Object.keys(require("eslint-plugin-jsx-a11y").rules).map((r) => [
          `jsx-a11y/${r}`,
          "warn",
        ])
      ),
      languageOptions: {
        parser: require("@babel/eslint-parser"),
        parserOptions: {
          requireConfigFile: false,
          babelOptions: { presets: ["@babel/preset-react"] },
        },
      },
    },
    // Only lint the specific files
  });

  const results = await eslint.lintFiles(filePaths);
  const evidenceMap = new Map<string, Evidence[]>();

  for (const result of results) {
    for (const message of result.messages) {
      if (!message.ruleId) continue;
      const ruleId = message.ruleId.replace("jsx-a11y/", "");
      const criterionIds = ruleMapping[ruleId] ?? ruleMapping[`jsx-a11y/${ruleId}`] ?? [];
      for (const criterionId of criterionIds) {
        const existing = evidenceMap.get(criterionId) ?? [];
        existing.push({
          source: "source-scan",
          detail: `ESLint(${message.ruleId}): ${message.message}`,
          ref: `${result.filePath}:${message.line}:${message.column}`,
          rawId: message.ruleId,
          capturedAt: new Date().toISOString(),
        });
        evidenceMap.set(criterionId, existing);
      }
    }
  }

  return evidenceMap;
}
