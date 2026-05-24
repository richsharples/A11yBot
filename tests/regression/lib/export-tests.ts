/**
 * Functional tests for .docx export content.
 * Goes beyond the scan baseline check (which only verifies file size)
 * to assert that specific content lands in the document correctly.
 * Uses the docx zip structure (docx is a zip of XML files) to inspect
 * document.xml without needing a full docx parser.
 */

import JSZip from "jszip";
import type { VpatApiClient } from "./api";

export interface ExportTestResult {
  name: string;
  passed: boolean;
  error?: string;
}

async function test(name: string, fn: () => Promise<void>): Promise<ExportTestResult> {
  try {
    await fn();
    return { name, passed: true };
  } catch (err) {
    return { name, passed: false, error: String(err) };
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function getDocxText(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")?.async("string") ?? "";
  // Strip XML tags to get readable text
  return xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

export async function runExportTests(api: VpatApiClient): Promise<ExportTestResult[]> {
  const results: ExportTestResult[] = [];

  // Setup: create a project with known state
  await api.resetProject();
  await api.createProject({
    productName: "Export Test Product",
    productVersion: "2.5.0",
    productDescription: "Product for export regression testing",
    contactName: "Export Tester",
    contactEmail: "export@a11ybot.test",
    edition: "508",
    mode: "interview",
    productComponents: ["web"],
  });

  // Set a known criterion state before exporting
  const project = await api.getProject() as { criteria: Record<string, { level: string }> };
  const webCriteria = Object.keys(project.criteria).filter(
    (id) => project.criteria[id].level === "notEvaluated"
  );
  assert(webCriteria.length > 0, "has notEvaluated criteria to update");

  const testCriterionId = webCriteria[0];
  await api.updateCriterion(testCriterionId, "partial", "Partially supported — keyboard navigation present but focus indicators are inconsistent.");

  // ── Export succeeds and produces a non-empty file ─────────────────────────
  results.push(await test("Export returns a non-empty .docx file", async () => {
    const result = await api.exportDocx();
    assert(result.success, "export succeeded");
    assert(result.sizeKb > 5, `file size ${result.sizeKb}KB seems too small`);
  }));

  // ── Export contains product metadata ─────────────────────────────────────
  results.push(await test("Export .docx contains product name and version", async () => {
    const { buffer } = await api.exportDocxBuffer();
    assert(!!buffer, "got docx buffer");
    const text = await getDocxText(buffer!);
    assert(text.includes("Export Test Product"), "product name present in document");
    assert(text.includes("2.5.0"), "product version present in document");
  }));

  // ── Export contains contact info ──────────────────────────────────────────
  results.push(await test("Export .docx contains contact name and email", async () => {
    const { buffer } = await api.exportDocxBuffer();
    const text = await getDocxText(buffer!);
    assert(text.includes("Export Tester"), "contact name present");
    assert(text.includes("export@a11ybot.test"), "contact email present");
  }));

  // ── Export contains our updated criterion remark ──────────────────────────
  results.push(await test("Export .docx contains updated criterion remark", async () => {
    const { buffer } = await api.exportDocxBuffer();
    const text = await getDocxText(buffer!);
    assert(
      text.includes("focus indicators are inconsistent"),
      "updated remark text appears in document"
    );
  }));

  // ── Export contains conformance level labels ──────────────────────────────
  results.push(await test("Export .docx contains conformance level labels", async () => {
    const { buffer } = await api.exportDocxBuffer();
    const text = await getDocxText(buffer!);
    assert(text.includes("Partially Supports"), "'Partially Supports' level label present");
    assert(text.includes("Not Applicable"), "'Not Applicable' label present for N/A criteria");
  }));

  // ── Export contains VPAT standard headings ────────────────────────────────
  results.push(await test("Export .docx contains VPAT standard headings", async () => {
    const { buffer } = await api.exportDocxBuffer();
    const text = await getDocxText(buffer!);
    assert(text.includes("VPAT"), "VPAT title present");
    assert(text.includes("508"), "Section 508 reference present");
    assert(text.includes("Product Details"), "Product Details section present");
    assert(text.includes("Evaluation Methods"), "Evaluation Methods section present");
  }));

  // ── Export with INT edition includes INT-specific content ─────────────────
  results.push(await test("INT edition export contains EN 301 549 reference", async () => {
    await api.resetProject();
    await api.createProject({
      productName: "INT Export Test",
      productVersion: "1.0",
      productDescription: "INT edition export test",
      contactName: "Test",
      contactEmail: "test@test.com",
      edition: "INT",
      mode: "interview",
      productComponents: ["web"],
    });
    const { buffer } = await api.exportDocxBuffer();
    const text = await getDocxText(buffer!);
    assert(text.includes("International"), "International edition label present");
  }));

  await api.resetProject();
  return results;
}

export function printExportResults(results: ExportTestResult[]): { passed: number; failed: number } {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log("\n  Export content tests:");
  for (const r of results) {
    console.log(`    ${r.passed ? "✓" : "✗"} ${r.name}`);
    if (!r.passed && r.error) console.log(`      ${r.error}`);
  }
  console.log(`\n  Export tests: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}
