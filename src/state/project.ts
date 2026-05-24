import { randomUUID } from "crypto";
import type {
  Project,
  CriterionState,
  ConformanceLevel,
  Evidence,
  Confidence,
  Edition,
  ProductComponent,
} from "../types";
import { readFileSync } from "fs";
import { CriteriaFileSchema } from "../types";
import { getCriteriaFilePath } from "./criteria-store";
import { log, writeRunLog } from "./log";
import { saveProject, scheduleSave } from "./project-store";

// Store on globalThis so it survives Next.js App Router module re-evaluation
declare global {
  // eslint-disable-next-line no-var
  var __vpatProject: Project | null;
}
if (typeof globalThis.__vpatProject === "undefined") globalThis.__vpatProject = null;

export function getProject(): Project | null {
  return globalThis.__vpatProject;
}

export function requireProject(): Project {
  if (!globalThis.__vpatProject) throw new Error("No active project. Create a project first.");
  return globalThis.__vpatProject;
}

export function createProject(params: {
  productName: string;
  productVersion: string;
  productDescription: string;
  contactName: string;
  contactEmail: string;
  edition: Edition;
  mode: Project["mode"];
  productComponents: ProductComponent[];
  sourcePath?: string;
  runtimeUrl?: string;
}): Project {
  const criteriaFile = getCriteriaFile(params.edition);
  const componentSet = new Set<string>(params.productComponents);
  const now = new Date().toISOString();

  const criteriaMap: Record<string, CriterionState> = {};
  for (const chapter of criteriaFile.chapters) {
    for (const criterion of chapter.criteria) {
      const inScope = criterion.appliesTo.some((c) => componentSet.has(c));
      if (inScope) {
        criteriaMap[criterion.id] = {
          id: criterion.id,
          level: "notEvaluated",
          remark: "",
          confidence: "ai-inferred",
          evidence: [],
          history: [],
        };
      } else {
        criteriaMap[criterion.id] = {
          id: criterion.id,
          level: "notApplicable",
          remark: `Not applicable — ${criterion.appliesTo.join("/")} not present in this product.`,
          confidence: "pm-confirmed",
          evidence: [],
          history: [{ at: now, level: "notApplicable", remark: "Auto-set at project creation based on selected product components." }],
        };
      }
    }
  }

  const project: Project = {
    id: randomUUID(),
    ...params,
    createdAt: new Date().toISOString(),
    criteria: criteriaMap,
  };

  globalThis.__vpatProject = project;
  log.info({ event: "project.created", projectId: project.id, edition: project.edition }, "Project created");
  writeRunLog({ event: "project.created", projectId: project.id, project });
  saveProject(project);
  return project;
}

export function resetProject(): void {
  globalThis.__vpatProject = null;
  log.info({ event: "project.reset" }, "Project reset — session cleared");
  writeRunLog({ event: "project.reset" });
}

export function clearScanEvidence(source: "source-scan" | "runtime-scan"): { aiInferredReset: number } {
  const project = requireProject();
  for (const cs of Object.values(project.criteria)) {
    cs.evidence = cs.evidence.filter((e) => e.source !== source);
  }
  // ai-inferred text was derived purely from scanner evidence — it's stale after a rescan
  let aiInferredReset = 0;
  for (const cs of Object.values(project.criteria)) {
    if (cs.confidence === "ai-inferred") {
      cs.level = "notEvaluated";
      cs.remark = "";
      aiInferredReset++;
    }
  }
  log.info({ event: "evidence.cleared", source, aiInferredReset });
  writeRunLog({ event: "evidence.cleared", source, aiInferredReset });
  scheduleSave();
  return { aiInferredReset };
}

export function addEvidence(criterionId: string, evidence: Evidence): boolean {
  const project = requireProject();
  const cs = project.criteria[criterionId];
  if (!cs) return false; // criterion not in this edition — skip silently
  cs.evidence.push(evidence);
  writeRunLog({ event: "evidence.added", criterionId, evidence });
  scheduleSave();
  return true;
}

export function updateCriterion(
  criterionId: string,
  updates: { level: ConformanceLevel; remark: string; confidence: Confidence }
): CriterionState {
  const project = requireProject();
  const cs = project.criteria[criterionId];
  if (!cs) throw new Error(`Unknown criterion: ${criterionId}`);

  cs.history.push({ at: new Date().toISOString(), level: cs.level, remark: cs.remark });
  cs.level = updates.level;
  cs.remark = updates.remark;
  cs.confidence = updates.confidence;

  log.info({ event: "criterion.updated", criterionId, level: updates.level, confidence: updates.confidence });
  writeRunLog({ event: "criterion.updated", criterionId, state: cs });
  scheduleSave();
  return cs;
}

export function updateProjectPaths(sourcePath: string | undefined, runtimeUrl: string | undefined): Project {
  const project = requireProject();
  if (sourcePath !== undefined) project.sourcePath = sourcePath || undefined;
  if (runtimeUrl !== undefined) project.runtimeUrl = runtimeUrl || undefined;
  scheduleSave();
  return project;
}

export function getCriteriaFile(edition: Edition) {
  const path = getCriteriaFilePath(edition);
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  return CriteriaFileSchema.parse(raw);
}
