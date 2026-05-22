// Types shared across the regression test suite

export interface TargetConfig {
  id: string;
  name: string;
  /** Absolute path to source root for scanning */
  sourcePath: string;
  /** GitHub URL to clone from if not already present */
  githubUrl?: string;
  /** Path (relative to project root) where the OSS clone should live */
  cloneDir?: string;
  productComponents: Array<"web" | "software" | "hardware" | "docs" | "support">;
  edition: "508" | "INT";
  description: string;
  /**
   * "exact"     — every finding and count must match baseline precisely (use for fixtures)
   * "tolerance" — counts may drift ±TOLERANCE_PCT % (use for live codebases)
   */
  matchMode: "exact" | "tolerance";
}

export interface ScanSnapshot {
  capturedAt: string;
  toolVersion: string;
  targetId: string;
  sourceScan: {
    filesFound: { jsx: number; html: number; vue: number; css: number };
    evidenceAdded: number;
    criteriaHit: number;
  };
  criteria: {
    total: number;
    notApplicable: number;
    notEvaluated: number;
  };
  export: {
    success: boolean;
    sizeKb: number;
  };
}

export type RegressionStatus = "new" | "pass" | "regression" | "improved" | "changed";

export interface ComparisonEntry {
  field: string;
  baseline: number | boolean;
  current: number | boolean;
  delta?: string;
  severity: "pass" | "warn" | "fail";
}

export interface ComparisonResult {
  targetId: string;
  targetName: string;
  status: RegressionStatus;
  snapshot: ScanSnapshot;
  baseline?: ScanSnapshot;
  entries: ComparisonEntry[];
  regressions: string[];
  improvements: string[];
  warnings: string[];
}

export interface RunReport {
  runAt: string;
  toolVersion: string;
  serverUrl: string;
  results: ComparisonResult[];
  summary: {
    total: number;
    passed: number;
    regressed: number;
    improved: number;
    newBaselines: number;
    skipped: number;
  };
}
