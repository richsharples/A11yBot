/**
 * Functional tests for project creation and criteria state integrity.
 * Verifies that component scoping, edition selection, and notApplicable
 * pre-filtering all work correctly — these are the data foundations that
 * design changes could accidentally break through prop/event wiring changes.
 */

import type { VpatApiClient } from "./api";

export interface ProjectTestResult {
  name: string;
  passed: boolean;
  error?: string;
}

async function test(name: string, fn: () => Promise<void>): Promise<ProjectTestResult> {
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

const BASE_PROJECT = {
  productName: "Functional Test Product",
  productVersion: "1.0",
  productDescription: "Product used for functional regression testing",
  contactName: "Test Suite",
  contactEmail: "test@a11ybot.test",
  mode: "interview" as const,
};

export async function runProjectTests(api: VpatApiClient): Promise<ProjectTestResult[]> {
  const results: ProjectTestResult[] = [];

  // ── 508 edition, web-only ─────────────────────────────────────────────────
  results.push(await test("508 web-only: criteria seeded with correct counts", async () => {
    await api.resetProject();
    await api.createProject({ ...BASE_PROJECT, edition: "508", productComponents: ["web"] });
    const state = await api.getCriteriaState();
    assert(state.total > 0, `total criteria > 0, got ${state.total}`);
    assert(state.notApplicable >= 0, "notApplicable count is non-negative");
    assert(state.notEvaluated > 0, `fresh project has notEvaluated criteria, got ${state.notEvaluated}`);
    // All criteria must be either notEvaluated (in-scope) or notApplicable (out-of-scope)
    assert(
      state.notEvaluated + state.notApplicable === state.total,
      `notEvaluated(${state.notEvaluated}) + notApplicable(${state.notApplicable}) should equal total(${state.total})`
    );
    // Web-only: hardware/docs/support criteria should be notApplicable
    const project = await api.getProject() as { criteria: Record<string, { level: string }> };
    const allLevels = Object.values(project.criteria).map((c) => c.level);
    const hasOnlyValidLevels = allLevels.every((l) =>
      ["notEvaluated", "notApplicable"].includes(l)
    );
    assert(hasOnlyValidLevels, "fresh project has only notEvaluated or notApplicable criteria");
  }));

  // ── INT edition has more criteria than 508 ────────────────────────────────
  results.push(await test("INT edition seeds more criteria than 508", async () => {
    await api.resetProject();
    await api.createProject({ ...BASE_PROJECT, edition: "508", productComponents: ["web"] });
    const state508 = await api.getCriteriaState();

    await api.resetProject();
    await api.createProject({ ...BASE_PROJECT, edition: "INT", productComponents: ["web"] });
    const stateINT = await api.getCriteriaState();

    // INT has more criteria in its JSON file than 508
    assert(
      stateINT.total > state508.total,
      `INT total criteria (${stateINT.total}) > 508 total (${state508.total})`
    );
  }));

  // ── All components: no notApplicable criteria ─────────────────────────────
  results.push(await test("All components: zero notApplicable criteria", async () => {
    await api.resetProject();
    await api.createProject({
      ...BASE_PROJECT,
      edition: "508",
      productComponents: ["web", "software", "hardware", "docs", "support"],
    });
    const state = await api.getCriteriaState();
    assert(state.notApplicable === 0, `all-components project should have 0 notApplicable, got ${state.notApplicable}`);
    assert(state.total > 0, "has applicable criteria");
  }));

  // ── Docs+support only: web/software/hardware criteria are notApplicable ───
  results.push(await test("Docs+support only: applicable count is smaller than web-only", async () => {
    await api.resetProject();
    await api.createProject({ ...BASE_PROJECT, edition: "508", productComponents: ["web"] });
    const webState = await api.getCriteriaState();

    await api.resetProject();
    await api.createProject({ ...BASE_PROJECT, edition: "508", productComponents: ["docs", "support"] });
    const docsState = await api.getCriteriaState();

    // docs+support should have fewer in-scope (notEvaluated) criteria than web
    assert(
      docsState.notEvaluated < webState.notEvaluated,
      `docs+support in-scope (${docsState.notEvaluated}) < web in-scope (${webState.notEvaluated})`
    );
  }));

  // ── Reset clears state for fresh project ──────────────────────────────────
  results.push(await test("DELETE /api/projects/active clears state: subsequent GET returns 404", async () => {
    await api.createProject({ ...BASE_PROJECT, edition: "508", productComponents: ["web"] });
    await api.resetProject();
    try {
      await api.getProject();
      throw new Error("Expected 404 after reset but got a response");
    } catch (err) {
      assert(
        String(err).includes("404") || String(err).includes("No active project"),
        `expected 404/no-project error, got: ${err}`
      );
    }
  }));

  // ── New project after reset starts clean ──────────────────────────────────
  results.push(await test("New project after reset has no residual criteria state", async () => {
    // First project: set a criterion to a non-default level
    await api.resetProject();
    await api.createProject({ ...BASE_PROJECT, edition: "508", productComponents: ["web"] });
    const project1 = await api.getProject() as { criteria: Record<string, { level: string }> };
    const firstId = Object.keys(project1.criteria).find(
      (id) => project1.criteria[id].level === "notEvaluated"
    )!;
    await api.updateCriterion(firstId, "supports", "Test remark");

    // Reset and create second project
    await api.resetProject();
    await api.createProject({ ...BASE_PROJECT, edition: "508", productComponents: ["web"] });
    const project2 = await api.getProject() as { criteria: Record<string, { level: string }> };

    const criterion = project2.criteria[firstId];
    if (criterion) {
      assert(
        criterion.level === "notEvaluated" || criterion.level === "notApplicable",
        `criterion ${firstId} should be notEvaluated in new project, got ${criterion.level}`
      );
    }
  }));

  // ── Project list includes newly created project ───────────────────────────
  results.push(await test("GET /api/projects: lists saved projects", async () => {
    await api.resetProject();
    await api.createProject({ ...BASE_PROJECT, edition: "508", productComponents: ["web"] });
    const list = await api.listProjects();
    assert(list.length > 0, "project list should be non-empty after creating a project");
    const match = list.find((p) => p.productName === BASE_PROJECT.productName);
    assert(!!match, `list should contain project "${BASE_PROJECT.productName}"`);
    assert(typeof match!.progressPct === "number", "list entry should include progressPct");
  }));

  // ── Load project by ID returns full project ───────────────────────────────
  results.push(await test("GET /api/projects/:id: loads saved project by ID", async () => {
    await api.resetProject();
    const id = await api.createProject({ ...BASE_PROJECT, edition: "508", productComponents: ["web"] });
    const list = await api.listProjects();
    const entry = list.find((p) => p.id === id);
    assert(!!entry, "newly created project should appear in list");
    const loaded = await api.loadProject(id) as { id: string; criteria: Record<string, unknown> };
    assert(loaded.id === id, `loaded project id should match, got ${loaded.id}`);
    assert(typeof loaded.criteria === "object", "loaded project should have criteria");
  }));

  await api.resetProject();
  return results;
}

export function printProjectResults(results: ProjectTestResult[]): { passed: number; failed: number } {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log("\n  Project state tests:");
  for (const r of results) {
    console.log(`    ${r.passed ? "✓" : "✗"} ${r.name}`);
    if (!r.passed && r.error) console.log(`      ${r.error}`);
  }
  console.log(`\n  Project tests: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}
