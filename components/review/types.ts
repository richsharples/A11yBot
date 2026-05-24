import type { ConformanceLevel } from "@/src/types";

export type StatusLevel = "info" | "warn" | "error" | "running";
export type StatusEntry = { id: number; ts: string; level: StatusLevel; message: string };

export type PushStatus = (level: StatusLevel, message: string) => number;
export type ResolveStatus = (id: number, level: Exclude<StatusLevel, "running">, message: string) => void;
export type UpdateStatus = (id: number, message: string) => void;

export type EvidenceSignal = { scannerCount: number; interviewCount: number };

export const LEVEL_LABELS: Record<ConformanceLevel, string> = {
  supports: "Supports",
  partial: "Partially Supports",
  doesNotSupport: "Does Not Support",
  notApplicable: "Not Applicable",
  notEvaluated: "Not Evaluated",
};

export const LEVEL_COLORS: Record<ConformanceLevel, string> = {
  supports: "bg-green-100 text-green-800 border-green-200",
  partial: "bg-yellow-100 text-yellow-800 border-yellow-200",
  doesNotSupport: "bg-red-100 text-red-800 border-red-200",
  notApplicable: "bg-gray-100 text-gray-600 border-gray-200",
  notEvaluated: "bg-slate-100 text-slate-600 border-slate-200",
};

export type CriteriaData = { chapters: { id: string; title: string; criteria: { id: string; ref: string; text: string; interviewQuestion?: string }[] }[] };

export function getEvidenceSignal(evidence: import("@/src/types").Evidence[]): EvidenceSignal {
  return {
    scannerCount: evidence.filter((e) => e.source === "source-scan" || e.source === "runtime-scan").length,
    interviewCount: evidence.filter((e) => e.source === "interview").length,
  };
}
