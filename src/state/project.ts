import { randomUUID } from "crypto";
import type {
  Project,
  CriterionState,
  ConformanceLevel,
  Evidence,
  Confidence,
  Edition,
} from "../types";
import { CriteriaFileSchema } from "../types";
import criteria508 from "../criteria/vpat-2.5-508.json";
import criteriaInt from "../criteria/vpat-2.5-int.json";
import { log, writeRunLog } from "./log";

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
  sourcePath?: string;
  runtimeUrl?: string;
}): Project {
  const criteriaRaw = params.edition === "508" ? criteria508 : criteriaInt;
  const criteriaFile = CriteriaFileSchema.parse(criteriaRaw);

  const criteriaMap: Record<string, CriterionState> = {};
  for (const chapter of criteriaFile.chapters) {
    for (const criterion of chapter.criteria) {
      criteriaMap[criterion.id] = {
        id: criterion.id,
        level: "notEvaluated",
        remark: "",
        confidence: "ai-inferred",
        evidence: [],
        history: [],
      };
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
  return project;
}

export function addEvidence(criterionId: string, evidence: Evidence): void {
  const project = requireProject();
  const cs = project.criteria[criterionId];
  if (!cs) throw new Error(`Unknown criterion: ${criterionId}`);
  cs.evidence.push(evidence);
  writeRunLog({ event: "evidence.added", criterionId, evidence });
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
  return cs;
}

export function getCriteriaFile(edition: Edition) {
  const raw = edition === "508" ? criteria508 : criteriaInt;
  return CriteriaFileSchema.parse(raw);
}
