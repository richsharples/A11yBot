import * as cheerio from "cheerio";
import { readFileSync } from "fs";
import type { Evidence } from "../types";
import type { RuleMapping } from "./source-jsx";

interface HtmlIssue {
  ruleId: string;
  message: string;
  selector?: string;
}

function checkHtml(html: string): HtmlIssue[] {
  const $ = cheerio.load(html);
  const issues: HtmlIssue[] = [];

  // Missing alt on img
  $("img:not([alt])").each((_, el) => {
    issues.push({ ruleId: "image-alt", message: `<img> missing alt attribute`, selector: $.html(el)?.slice(0, 80) });
  });

  // Empty alt check - img with empty alt that is not decorative
  $("img[alt='']").each((_, el) => {
    const src = $(el).attr("src") ?? "";
    if (!$(el).attr("role") && !$(el).attr("aria-hidden")) {
      issues.push({ ruleId: "image-alt-empty", message: `<img> has empty alt without aria-hidden`, selector: src });
    }
  });

  // Input without label
  $("input:not([type='hidden']):not([aria-label]):not([aria-labelledby]):not([title])").each((_, el) => {
    const id = $(el).attr("id");
    if (!id || $(`label[for="${id}"]`).length === 0) {
      issues.push({ ruleId: "label", message: `<input> has no associated label`, selector: $.html(el)?.slice(0, 80) });
    }
  });

  // Heading order — naive: check h1 present, no skipping
  const headingLevels: number[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    if ("tagName" in el) headingLevels.push(parseInt((el as { tagName: string }).tagName.slice(1), 10));
  });
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] - headingLevels[i - 1] > 1) {
      issues.push({ ruleId: "heading-order", message: `Heading level skips from h${headingLevels[i - 1]} to h${headingLevels[i]}` });
    }
  }

  // Button with no accessible name
  $("button:not([aria-label]):not([aria-labelledby]):not([title])").each((_, el) => {
    const text = $(el).text().trim();
    if (!text) {
      issues.push({ ruleId: "button-name", message: `<button> has no accessible name`, selector: $.html(el)?.slice(0, 80) });
    }
  });

  // Link with no accessible name
  $("a:not([aria-label]):not([aria-labelledby])").each((_, el) => {
    const text = $(el).text().trim();
    const img = $(el).find("img[alt]");
    if (!text && img.length === 0) {
      issues.push({ ruleId: "link-name", message: `<a> has no accessible name`, selector: $(el).attr("href") ?? "" });
    }
  });

  return issues;
}

export function scanHtmlFile(
  filePath: string,
  ruleMapping: RuleMapping
): Map<string, Evidence[]> {
  const html = readFileSync(filePath, "utf-8");
  const issues = checkHtml(html);
  const evidenceMap = new Map<string, Evidence[]>();

  for (const issue of issues) {
    const criterionIds = ruleMapping[issue.ruleId] ?? [];
    for (const criterionId of criterionIds) {
      const existing = evidenceMap.get(criterionId) ?? [];
      existing.push({
        source: "source-scan",
        detail: `HTML(${issue.ruleId}): ${issue.message}`,
        ref: filePath + (issue.selector ? ` → ${issue.selector}` : ""),
        rawId: issue.ruleId,
        capturedAt: new Date().toISOString(),
      });
      evidenceMap.set(criterionId, existing);
    }
  }

  return evidenceMap;
}
