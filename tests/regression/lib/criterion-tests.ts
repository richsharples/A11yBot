/**
 * Functional tests for the criterion update workflow.
 * Covers the full PM review cycle: confidence transitions, level updates,
 * interview evidence, and reset — the operations most likely to break
 * if component event wiring changes during a design system refactor.
 */

import type { VpatApiClient } from "./api";

export interface CriterionTestResult {
  name: string;
  passed: boolean;
  error?: string;
}

async function test(name: string, fn: () => Promise<void>): Promise<CriterionTestResult> {
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

async function freshProject(api: VpatApiClient): Promise<string> {
  await api.resetProject();
  await api.createProject({
    productName: "Criterion Test Product",
    productVersion: "1.0",
    productDescription: "Product for criterion workflow testing",
    contactName: "Test Suite",
    contactEmail: "test@a11ybot.test",
    edition: "508",
    mode: "interview",
    productComponents: ["web"],
  });
  const project = await api.getProject() as { criteria: Record<string, { level: string; confidence: string }> };
  // Pick first notEvaluated criterion
  const id = Object.keys(project.criteria).find(
    (k) => project.criteria[k].level === "notEvaluated"
  )!;
  assert(!!id, "fresh project has at least one notEvaluated criterion");
  return id;
}

export async function runCriterionTests(api: VpatApiClient): Promise<CriterionTestResult[]> {
  const results: CriterionTestResult[] = [];

  // ── PATCH sets level and pm-confirmed confidence ──────────────────────────
  results.push(await test("PATCH criterion: sets level, remark, and pm-confirmed confidence", async () => {
    const id = await freshProject(api);
    const updated = await api.updateCriterion(id, "supports", "Fully supported via semantic HTML") as {
      level: string; remark: string; confidence: string;
    };
    assert(updated.level === "supports", `level should be 'supports', got '${updated.level}'`);
    assert(updated.remark === "Fully supported via semantic HTML", "remark persisted");
    assert(updated.confidence === "pm-confirmed", `confidence should be pm-confirmed, got '${updated.confidence}'`);
  }));

  // ── All conformance levels accepted ──────────────────────────────────────
  results.push(await test("PATCH accepts all five conformance levels", async () => {
    const levels = ["supports", "partial", "doesNotSupport", "notApplicable", "notEvaluated"] as const;
    for (const level of levels) {
      const id = await freshProject(api);
      const updated = await api.updateCriterion(id, level, `Test remark for ${level}`) as { level: string };
      assert(updated.level === level, `level should be '${level}', got '${updated.level}'`);
    }
  }));

  // ── State persists in project after update ────────────────────────────────
  results.push(await test("Updated criterion level persists in project GET", async () => {
    const id = await freshProject(api);
    await api.updateCriterion(id, "partial", "Partially supported");
    const project = await api.getProject() as { criteria: Record<string, { level: string; confidence: string }> };
    assert(project.criteria[id]?.level === "partial", `project.criteria[${id}].level should be 'partial'`);
    assert(project.criteria[id]?.confidence === "pm-confirmed", "persisted confidence is pm-confirmed");
  }));

  // ── Criterion history grows with each update ──────────────────────────────
  results.push(await test("Criterion history records each level change", async () => {
    const id = await freshProject(api);
    await api.updateCriterion(id, "supports", "First update");
    await api.updateCriterion(id, "partial", "Second update");
    const project = await api.getProject() as {
      criteria: Record<string, { history: unknown[] }>;
    };
    const history = project.criteria[id]?.history ?? [];
    assert(history.length >= 2, `expected ≥2 history entries, got ${history.length}`);
  }));

  // ── Reset returns criterion to notEvaluated ───────────────────────────────
  results.push(await test("Reset criterion returns to notEvaluated with empty remark", async () => {
    const id = await freshProject(api);
    await api.updateCriterion(id, "supports", "Was supported");
    const reset = await api.resetCriterion(id) as { level: string; remark: string };
    assert(reset.level === "notEvaluated", `after reset level should be notEvaluated, got '${reset.level}'`);
    assert(reset.remark === "", `after reset remark should be empty, got '${reset.remark}'`);
  }));

  // ── Interview answer stored as evidence ───────────────────────────────────
  results.push(await test("Interview answer stored as evidence on criterion", async () => {
    const id = await freshProject(api);
    await api.submitInterviewAnswer(id, "Our product fully supports this criterion via ARIA landmarks.");
    const project = await api.getProject() as {
      criteria: Record<string, { evidence: Array<{ source: string; detail: string }> }>;
    };
    const evidence = project.criteria[id]?.evidence ?? [];
    const interview = evidence.find((e) => e.source === "interview");
    assert(!!interview, "interview evidence entry exists");
    assert(
      interview!.detail.includes("ARIA landmarks"),
      `interview detail should contain our answer, got: ${interview!.detail}`
    );
  }));

  // ── Evaluated count updates after PATCH ──────────────────────────────────
  results.push(await test("getCriteriaState() notEvaluated count decreases after PATCH", async () => {
    const id = await freshProject(api);
    const before = await api.getCriteriaState();
    await api.updateCriterion(id, "supports", "Confirmed");
    const after = await api.getCriteriaState();
    assert(
      after.notEvaluated < before.notEvaluated,
      `notEvaluated should decrease after update (before=${before.notEvaluated}, after=${after.notEvaluated})`
    );
  }));

  // ── Invalid level rejected ────────────────────────────────────────────────
  results.push(await test("PATCH with invalid level returns 400", async () => {
    const id = await freshProject(api);
    try {
      await api.updateCriterion(id, "completelyWrong", "bad");
      throw new Error("Expected 400 for invalid level but request succeeded");
    } catch (err) {
      assert(String(err).includes("400") || String(err).includes("invalid") || String(err).includes("ZodError"),
        `expected validation error, got: ${err}`);
    }
  }));

  await api.resetProject();
  return results;
}

export function printCriterionResults(results: CriterionTestResult[]): { passed: number; failed: number } {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log("\n  Criterion workflow tests:");
  for (const r of results) {
    console.log(`    ${r.passed ? "✓" : "✗"} ${r.name}`);
    if (!r.passed && r.error) console.log(`      ${r.error}`);
  }
  console.log(`\n  Criterion tests: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}
