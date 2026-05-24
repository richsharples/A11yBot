import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { ProjectSchema, type Project } from "../types";
import { log } from "./log";

const A11YBOT_DIR = join(homedir(), ".a11ybot");
const PROJECTS_DIR = join(A11YBOT_DIR, "projects");
const INDEX_FILE = join(A11YBOT_DIR, "index.json");

export interface ProjectIndexEntry {
  id: string;
  productName: string;
  productVersion: string;
  createdAt: string;
  lastModified: string;
  progressPct: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __saveTimer: ReturnType<typeof setTimeout> | null;
}
if (typeof globalThis.__saveTimer === "undefined") globalThis.__saveTimer = null;

function ensureDirs(): void {
  if (!existsSync(PROJECTS_DIR)) mkdirSync(PROJECTS_DIR, { recursive: true });
}

function computeProgress(project: Project): number {
  const states = Object.values(project.criteria);
  if (states.length === 0) return 0;
  const confirmed = states.filter((s) => s.confidence === "pm-confirmed").length;
  return Math.round((confirmed / states.length) * 100);
}

function readIndex(): ProjectIndexEntry[] {
  if (!existsSync(INDEX_FILE)) return [];
  try {
    return JSON.parse(readFileSync(INDEX_FILE, "utf-8")) as ProjectIndexEntry[];
  } catch {
    return [];
  }
}

function writeIndex(entries: ProjectIndexEntry[]): void {
  ensureDirs();
  writeFileSync(INDEX_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

function upsertIndex(entry: ProjectIndexEntry): void {
  const entries = readIndex();
  const idx = entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) entries[idx] = entry;
  else entries.unshift(entry);
  writeIndex(entries);
}

export function saveProject(project: Project): void {
  ensureDirs();
  writeFileSync(join(PROJECTS_DIR, `${project.id}.json`), JSON.stringify(project, null, 2), "utf-8");
  upsertIndex({
    id: project.id,
    productName: project.productName,
    productVersion: project.productVersion,
    createdAt: project.createdAt,
    lastModified: new Date().toISOString(),
    progressPct: computeProgress(project),
  });
  log.debug({ event: "project.saved", projectId: project.id });
}

export function scheduleSave(): void {
  if (globalThis.__saveTimer) clearTimeout(globalThis.__saveTimer);
  globalThis.__saveTimer = setTimeout(() => {
    const p = globalThis.__vpatProject;
    if (p) saveProject(p);
    globalThis.__saveTimer = null;
  }, 1500);
}

export function loadProjectFile(id: string): Project {
  const filePath = join(PROJECTS_DIR, `${id}.json`);
  if (!existsSync(filePath)) throw new Error(`Project not found: ${id}`);
  const raw = JSON.parse(readFileSync(filePath, "utf-8"));
  return ProjectSchema.parse(raw);
}

export function listProjects(): ProjectIndexEntry[] {
  return readIndex().sort((a, b) => b.lastModified.localeCompare(a.lastModified));
}
