#!/usr/bin/env tsx
/**
 * a11ybot regression test suite
 *
 * Usage:
 *   npm run regression                 # compare against saved baselines
 *   npm run regression:update          # run and overwrite baselines
 *   npm run regression:clone           # clone OSS targets (one-time setup)
 *   npm run regression -- --target fixture   # run single target only
 *
 * Exit codes:
 *   0 — all targets passed (or new baselines saved)
 *   1 — one or more regressions detected
 *   2 — server not reachable
 */

import path from "path";
import fs from "fs";
import { TARGETS } from "./targets";
import { VpatApiClient } from "./lib/api";
import { compare } from "./lib/compare";
import { printReport, saveReport } from "./lib/report";
import { ensureCloned, isCloned } from "./lib/clone";
import { runConfigTests, printConfigResults } from "./lib/config-tests";
import type { ScanSnapshot, ComparisonResult, RunReport } from "./types";

// ── Config ────────────────────────────────────────────────────────────────────

const SERVER_URL = process.env.VPAT_URL ?? "http://localhost:5173";
const BASELINES_DIR = path.join(__dirname, "baselines");
const REPORTS_DIR = path.join(__dirname, "../../.regression-reports");
const ROOT = path.resolve(__dirname, "../..");

// ── Arg parsing ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const UPDATE_BASELINE = args.includes("--update-baseline");
const CLONE_ONLY = args.includes("--clone");
const targetFilter = args.find((a) => a === "--target")
  ? args[args.indexOf("--target") + 1]
  : undefined;

// ── Helpers ───────────────────────────────────────────────────────────────────

function baselinePath(targetId: string): string {
  return path.join(BASELINES_DIR, `${targetId}.json`);
}

function loadBaseline(targetId: string): ScanSnapshot | null {
  const p = baselinePath(targetId);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8")) as ScanSnapshot;
}

function saveBaseline(snapshot: ScanSnapshot): void {
  fs.mkdirSync(BASELINES_DIR, { recursive: true });
  fs.writeFileSync(baselinePath(snapshot.targetId), JSON.stringify(snapshot, null, 2));
}

async function runTarget(
  api: VpatApiClient,
  target: (typeof TARGETS)[number],
  toolVersion: string
): Promise<ScanSnapshot> {
  console.log(`\n  Running: ${target.name}`);
  console.log(`    Source : ${target.sourcePath}`);

  // Create a fresh project (resets in-memory state)
  await api.createProject({
    productName: `Regression — ${target.name}`,
    productVersion: "test",
    productDescription: `Automated regression run for ${target.id}`,
    contactName: "Regression Suite",
    contactEmail: "regression@a11ybot.test",
    edition: target.edition,
    mode: "interview",
    productComponents: target.productComponents,
  });

  // Source scan
  console.log("    Scanning source…");
  const scanResult = await api.runSourceScan(target.sourcePath);
  console.log(
    `    Found: ${scanResult.evidenceAdded} evidence items across ${scanResult.criteriaHit} criteria` +
      ` (${scanResult.filesFound.jsx} JSX, ${scanResult.filesFound.html} HTML, ${scanResult.filesFound.vue} Vue, ${scanResult.filesFound.css} CSS)`
  );

  // Criteria state
  const criteria = await api.getCriteriaState();
  console.log(
    `    Criteria: ${criteria.total} total, ${criteria.notApplicable} N/A, ${criteria.notEvaluated} not evaluated`
  );

  // Export
  console.log("    Exporting .docx…");
  const exportResult = await api.exportDocx();
  console.log(
    exportResult.success
      ? `    Export: ✓ ${exportResult.sizeKb} KB`
      : "    Export: ✗ failed"
  );

  return {
    capturedAt: new Date().toISOString(),
    toolVersion,
    targetId: target.id,
    sourceScan: scanResult,
    criteria,
    export: exportResult,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // ── Clone-only mode ──
  if (CLONE_ONLY) {
    console.log("\n  Cloning OSS targets…\n");
    for (const t of TARGETS) {
      if (!t.githubUrl || !t.cloneDir) continue;
      const cloneTarget = path.join(ROOT, t.cloneDir);
      ensureCloned(t.githubUrl, cloneTarget);
    }
    console.log("\n  Done. Run `npm run regression` to use them.\n");
    return;
  }

  const api = new VpatApiClient(SERVER_URL);

  // ── Server check ──
  console.log(`\n  Checking server at ${SERVER_URL}…`);
  const alive = await api.ping();
  if (!alive) {
    console.error(`\n  ❌ Server not reachable at ${SERVER_URL}.`);
    console.error("     Start it with: npm run dev\n");
    process.exit(2);
  }

  const toolVersion = await api.getToolVersion();
  console.log(`  Server OK — criteria version ${toolVersion}`);

  // ── Config integration tests (always run, skip with --target flag) ──
  let configFailed = 0;
  if (!targetFilter) {
    console.log("\n  Running config integration tests…");
    const configResults = await runConfigTests(api);
    const { failed } = printConfigResults(configResults);
    configFailed = failed;
  }

  // ── Filter targets ──
  const targets = targetFilter
    ? TARGETS.filter((t) => t.id === targetFilter)
    : TARGETS;

  if (targets.length === 0) {
    console.error(`  No target matched "${targetFilter}". Available: ${TARGETS.map((t) => t.id).join(", ")}`);
    process.exit(1);
  }

  const results: ComparisonResult[] = [];
  const skipped: Array<{ targetId: string; targetName: string; status: "skipped"; reason: string }> = [];

  for (const target of targets) {
    // Check clone requirement
    if (target.githubUrl && !isCloned(target.sourcePath)) {
      console.log(`\n  ⏭️  Skipping ${target.name} — not cloned.`);
      console.log(`     Run: npm run regression:clone`);
      skipped.push({
        targetId: target.id,
        targetName: target.name,
        status: "skipped",
        reason: "OSS repo not cloned. Run npm run regression:clone",
      });
      continue;
    }

    // Check source path exists
    if (!fs.existsSync(target.sourcePath)) {
      console.log(`\n  ⏭️  Skipping ${target.name} — source path not found: ${target.sourcePath}`);
      skipped.push({
        targetId: target.id,
        targetName: target.name,
        status: "skipped",
        reason: `Source path not found: ${target.sourcePath}`,
      });
      continue;
    }

    try {
      const snapshot = await runTarget(api, target, toolVersion);
      const baseline = loadBaseline(target.id);

      if (UPDATE_BASELINE || !baseline) {
        saveBaseline(snapshot);
        const isNew = !baseline;
        results.push({
          targetId: target.id,
          targetName: target.name,
          status: "new",
          snapshot,
          entries: [],
          regressions: [],
          improvements: [],
          warnings: [],
        });
        console.log(`    ${isNew ? "🆕 Baseline saved" : "✅ Baseline updated"}`);
      } else {
        const comparison = compare(snapshot, baseline, target);
        results.push(comparison);
        const icon =
          comparison.status === "pass" ? "✅" :
          comparison.status === "regression" ? "❌" :
          comparison.status === "improved" ? "📈" : "⚠️";
        console.log(`    ${icon} ${comparison.status.toUpperCase()}`);
      }
    } catch (err) {
      console.error(`\n  ❌ Error running ${target.name}: ${err}`);
      results.push({
        targetId: target.id,
        targetName: target.name,
        status: "regression",
        snapshot: null as unknown as ScanSnapshot,
        entries: [],
        regressions: [`Unhandled error: ${err}`],
        improvements: [],
        warnings: [],
      });
    }
  }

  // ── Report ──
  const summary = {
    total: results.length + skipped.length,
    passed: results.filter((r) => r.status === "pass").length,
    regressed: results.filter((r) => r.status === "regression").length,
    improved: results.filter((r) => r.status === "improved").length,
    newBaselines: results.filter((r) => r.status === "new").length,
    skipped: skipped.length,
  };

  const report: RunReport = {
    runAt: new Date().toISOString(),
    toolVersion,
    serverUrl: SERVER_URL,
    results,
    summary,
  };

  printReport(report, skipped);

  // Save JSON report for CI artifacts
  if (!UPDATE_BASELINE) {
    const saved = saveReport(report, REPORTS_DIR);
    console.log(`  Report saved: ${path.relative(ROOT, saved)}\n`);
  }

  process.exit(summary.regressed > 0 || configFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\n  Fatal error:", err);
  process.exit(2);
});
