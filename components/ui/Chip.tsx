import * as React from "react";
import type { ConformanceLevel } from "@/src/types";

const styles: Record<ConformanceLevel, string> = {
  supports:       "bg-ok-bg text-ok border-ok-rule",
  partial:        "bg-warn-bg text-warn border-warn-rule",
  doesNotSupport: "bg-issue-bg text-issue border-issue-rule",
  notApplicable:  "bg-surface-3 text-ink-3 border-rule",
  notEvaluated:   "bg-transparent text-ink-4 border-dashed border-ink-5",
};

const labels: Record<ConformanceLevel, string> = {
  supports:       "Supports",
  partial:        "Partial",
  doesNotSupport: "Does Not Support",
  notApplicable:  "N/A",
  notEvaluated:   "Not Evaluated",
};

interface ChipProps {
  level: ConformanceLevel;
  className?: string;
}

export function Chip({ level, className = "" }: ChipProps) {
  return (
    <span className={`inline-flex items-center font-mono text-caption uppercase tracking-wide px-1.5 py-0.5 rounded-sm border ${styles[level]} ${className}`}>
      {labels[level]}
    </span>
  );
}

export default Chip;
