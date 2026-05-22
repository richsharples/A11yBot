import fs from "fs";
import path from "path";
import type { RunReport, ComparisonResult } from "../types";

const ICONS = {
  pass: "✅",
  regression: "❌",
  improved: "📈",
  changed: "⚠️",
  new: "🆕",
  skipped: "⏭️",
} as const;

function statusLine(r: ComparisonResult | { targetId: string; targetName: string; status: "skipped"; reason: string }): string {
  const icon = ICONS[r.status] ?? "❓";
  const name = r.targetName;
  if (r.status === "skipped") return `  ${icon}  ${name} — ${(r as { reason: string }).reason}`;
  if (r.status === "new") return `  ${icon}  ${name} — baseline saved`;
  return `  ${icon}  ${name}`;
}

export function printReport(report: RunReport, skipped: Array<{ targetId: string; targetName: string; status: "skipped"; reason: string }> = []): void {
  const { results, summary } = report;
  const divider = "─".repeat(60);

  console.log("\n" + divider);
  console.log("  VPAT Tool Regression Suite");
  console.log(`  Run at : ${report.runAt}`);
  console.log(`  Server : ${report.serverUrl}`);
  console.log(`  Tool   : v${report.toolVersion}`);
  console.log(divider + "\n");

  for (const r of results) {
    console.log(statusLine(r));
    if (r.status === "pass") continue;

    if (r.regressions.length > 0) {
      console.log("    Regressions:");
      r.regressions.forEach((msg) => console.log(`      ✗ ${msg}`));
    }
    if (r.improvements.length > 0) {
      console.log("    Improvements:");
      r.improvements.forEach((msg) => console.log(`      ✓ ${msg}`));
    }
    if (r.warnings.length > 0) {
      console.log("    Changed (within tolerance):");
      r.warnings.forEach((msg) => console.log(`      ~ ${msg}`));
    }

    // Show detail table for non-pass
    if (r.entries.length > 0) {
      console.log("    Detail:");
      for (const e of r.entries) {
        const mark = e.severity === "fail" ? "✗" : e.severity === "warn" ? "~" : "✓";
        const delta = e.delta ? ` (${e.delta})` : "";
        console.log(`      ${mark} ${e.field.padEnd(28)} ${String(e.baseline).padStart(6)} → ${String(e.current).padStart(6)}${delta}`);
      }
    }
    console.log();
  }

  for (const s of skipped) {
    console.log(statusLine(s));
  }

  console.log("\n" + divider);
  console.log(`  Summary: ${summary.total} targets`);
  if (summary.passed > 0)      console.log(`    ${ICONS.pass}  Passed     : ${summary.passed}`);
  if (summary.newBaselines > 0) console.log(`    ${ICONS.new}  New baselines : ${summary.newBaselines}`);
  if (summary.improved > 0)    console.log(`    ${ICONS.improved}  Improved   : ${summary.improved}`);
  if (summary.regressed > 0)   console.log(`    ${ICONS.regression}  Regressions: ${summary.regressed}`);
  if (summary.skipped > 0)     console.log(`    ${ICONS.skipped}  Skipped    : ${summary.skipped}`);
  console.log(divider + "\n");

  if (summary.regressed > 0) {
    console.log("  ❌ REGRESSION DETECTED — fix the issues above before releasing.\n");
  } else if (summary.improved > 0) {
    console.log("  📈 Improvements detected — run with --update-baseline to accept.\n");
  } else if (summary.newBaselines > 0) {
    console.log("  🆕 New baselines saved. Commit tests/regression/baselines/ to lock them in.\n");
  } else {
    console.log("  ✅ All checks passed.\n");
  }
}

export function saveReport(report: RunReport, dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  const filename = `regression-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  return filepath;
}
