import { parse as parseSfc } from "@vue/compiler-sfc";
import { readFileSync } from "fs";
import * as cheerio from "cheerio";
import type { Evidence } from "../types";
import type { RuleMapping } from "./source-jsx";
import { scanHtmlFile } from "./source-html";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

export function scanVueFile(
  filePath: string,
  ruleMapping: RuleMapping
): Map<string, Evidence[]> {
  const source = readFileSync(filePath, "utf-8");
  const { descriptor } = parseSfc(source);
  if (!descriptor.template) return new Map();

  // Extract template HTML and run HTML checks on it
  const templateHtml = descriptor.template.content;
  const tmpFile = join(tmpdir(), `vpat-vue-${randomUUID()}.html`);
  try {
    writeFileSync(tmpFile, templateHtml, "utf-8");
    const result = scanHtmlFile(tmpFile, ruleMapping);
    // Remap refs to the original .vue file
    const remapped = new Map<string, Evidence[]>();
    for (const [criterionId, evidences] of result) {
      remapped.set(criterionId, evidences.map((e) => ({
        ...e,
        ref: e.ref?.replace(tmpFile, filePath) ?? filePath,
      })));
    }
    return remapped;
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}
