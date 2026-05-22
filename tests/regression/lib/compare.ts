import type {
  ScanSnapshot,
  ComparisonResult,
  ComparisonEntry,
  TargetConfig,
} from "../types";

/** Tolerance for "tolerance" match mode — findings may drift ±this% */
const TOLERANCE_PCT = 20;

function pct(current: number, baseline: number): string {
  if (baseline === 0) return current > 0 ? `+${current}` : "–";
  const delta = ((current - baseline) / baseline) * 100;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}%`;
}

function numEntry(
  field: string,
  current: number,
  baseline: number,
  config: { higherIsBetter?: boolean; exact?: boolean; tolerancePct?: number }
): ComparisonEntry {
  const { higherIsBetter = false, exact = false, tolerancePct = TOLERANCE_PCT } = config;
  const delta = pct(current, baseline);

  if (exact) {
    const ok = current === baseline;
    return { field, baseline, current, delta, severity: ok ? "pass" : "fail" };
  }

  // Tolerance mode
  const ratio = baseline === 0 ? 1 : current / baseline;
  const lower = 1 - tolerancePct / 100;
  const upper = 1 + tolerancePct / 100;

  let severity: ComparisonEntry["severity"];
  if (higherIsBetter) {
    // More is better (e.g. findings count — more means scanner is still working)
    severity = ratio < lower ? "fail" : ratio > upper ? "warn" : "pass";
  } else {
    // Lower is better (e.g. N/A count — exact expected)
    severity = ratio < lower || ratio > upper ? "warn" : "pass";
  }

  return { field, baseline, current, delta, severity };
}

export function compare(
  snapshot: ScanSnapshot,
  baseline: ScanSnapshot,
  target: TargetConfig
): ComparisonResult {
  const exact = target.matchMode === "exact";
  const entries: ComparisonEntry[] = [];

  // ── Criteria seeding (always exact — deterministic by component selection) ──
  entries.push(numEntry("criteria.total", snapshot.criteria.total, baseline.criteria.total, { exact: true }));
  entries.push(numEntry("criteria.notApplicable", snapshot.criteria.notApplicable, baseline.criteria.notApplicable, { exact: true }));
  entries.push(numEntry("criteria.notEvaluated", snapshot.criteria.notEvaluated, baseline.criteria.notEvaluated, { exact: true }));

  // ── Source scan ──
  entries.push(numEntry(
    "scan.evidenceAdded",
    snapshot.sourceScan.evidenceAdded,
    baseline.sourceScan.evidenceAdded,
    { exact, higherIsBetter: true }
  ));
  entries.push(numEntry(
    "scan.criteriaHit",
    snapshot.sourceScan.criteriaHit,
    baseline.sourceScan.criteriaHit,
    { exact, higherIsBetter: true }
  ));

  // File counts are informational only (tolerance, not fail)
  entries.push(numEntry("scan.files.jsx", snapshot.sourceScan.filesFound.jsx, baseline.sourceScan.filesFound.jsx, { tolerancePct: 50 }));

  // ── Export ──
  const exportOk = snapshot.export.success === baseline.export.success;
  entries.push({
    field: "export.success",
    baseline: baseline.export.success,
    current: snapshot.export.success,
    severity: exportOk ? "pass" : "fail",
  });
  if (snapshot.export.success && baseline.export.success) {
    entries.push(numEntry("export.sizeKb", snapshot.export.sizeKb, baseline.export.sizeKb, { tolerancePct: 30 }));
  }

  // ── Classify ──
  const regressions = entries
    .filter((e) => e.severity === "fail")
    .map((e) => `${e.field}: expected ${e.baseline}, got ${e.current}${e.delta ? ` (${e.delta})` : ""}`);

  const warnings = entries
    .filter((e) => e.severity === "warn")
    .map((e) => `${e.field}: ${e.current} vs baseline ${e.baseline} (${e.delta})`);

  const improvements: string[] = [];
  if (!exact) {
    // Findings increasing is generally positive
    const evidenceEntry = entries.find((e) => e.field === "scan.evidenceAdded");
    if (evidenceEntry && typeof evidenceEntry.current === "number" && typeof evidenceEntry.baseline === "number") {
      if (evidenceEntry.current > evidenceEntry.baseline * (1 + TOLERANCE_PCT / 100)) {
        improvements.push(`scan.evidenceAdded improved: ${evidenceEntry.baseline} → ${evidenceEntry.current}`);
      }
    }
  }

  let status: ComparisonResult["status"];
  if (regressions.length > 0) {
    status = "regression";
  } else if (improvements.length > 0 && warnings.length === 0) {
    status = "improved";
  } else if (warnings.length > 0) {
    status = "changed";
  } else {
    status = "pass";
  }

  return {
    targetId: target.id,
    targetName: target.name,
    status,
    snapshot,
    baseline,
    entries,
    regressions,
    improvements,
    warnings,
  };
}
