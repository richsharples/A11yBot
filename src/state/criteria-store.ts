import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { log } from "./log";

const STORE_DIR = join(homedir(), ".vpat", "criteria");
const MANIFEST_FILENAME = "manifest.json";
const MANIFEST_PATH = join(STORE_DIR, MANIFEST_FILENAME);
const BUNDLED_DIR = join(process.cwd(), "src", "criteria");

export interface CriteriaSource {
  name: string;
  abbr: string;
  url: string;
  description: string;
  editions: string[];
}

export interface CriteriaManifest {
  criteriaVersion: string;
  releasedAt: string;
  notes: string;
  checkedAt?: string | null;
  checkUrl: string;
  editions: Record<string, { file: string; downloadUrl: string }>;
  sources: CriteriaSource[];
}

export interface CriteriaStatus {
  manifest: CriteriaManifest;
  storeDir: string;
  updateAvailable: boolean;
  remoteVersion: string | null;
  lastChecked: string | null;
  seededAt: string | null;
}

// Module-level init guard so we only run once per server process
let initState: "idle" | "pending" | "done" = "idle";
let initPromise: Promise<void> | null = null;
let seededAt: string | null = null;

export async function ensureCriteriaStore(): Promise<void> {
  if (initState === "done") return;
  if (initState === "pending" && initPromise) return initPromise;
  initState = "pending";
  initPromise = _init().then(() => { initState = "done"; }).catch((err) => {
    initState = "idle";
    log.warn({ err }, "Criteria store init failed (non-fatal)");
  });
  return initPromise;
}

async function _init(): Promise<void> {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }
  if (!existsSync(MANIFEST_PATH)) {
    await seedFromBundled();
  }
  // NOTE: Auto-update checking is not yet wired up (checkUrl is empty in current manifest).
  // To enable: set checkUrl in src/criteria/manifest.json and uncomment the call to checkForUpdates().
}

async function seedFromBundled(): Promise<void> {
  const bundledManifestPath = join(BUNDLED_DIR, MANIFEST_FILENAME);
  const bundledManifest: CriteriaManifest = JSON.parse(readFileSync(bundledManifestPath, "utf-8"));

  for (const { file } of Object.values(bundledManifest.editions)) {
    const src = join(BUNDLED_DIR, file);
    const dest = join(STORE_DIR, file);
    if (existsSync(src)) copyFileSync(src, dest);
  }

  seededAt = new Date().toISOString();
  writeManifest({ ...bundledManifest, checkedAt: null });
  log.info({ event: "criteria-store.seeded", version: bundledManifest.criteriaVersion, path: STORE_DIR });
}

export function readManifest(): CriteriaManifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
}

export function getCriteriaFilePath(edition: string): string {
  const manifest = readManifest();
  const info = manifest.editions[edition];
  if (!info) throw new Error(`Unknown criteria edition: ${edition}`);
  const local = join(STORE_DIR, info.file);
  if (existsSync(local)) return local;
  // Fallback to bundled if local file missing
  const bundled = join(BUNDLED_DIR, info.file);
  if (existsSync(bundled)) return bundled;
  throw new Error(`Criteria file not found for edition ${edition}`);
}

export async function getCriteriaStatus(): Promise<CriteriaStatus> {
  await ensureCriteriaStore();
  const manifest = readManifest();
  return {
    manifest,
    storeDir: STORE_DIR,
    updateAvailable: false,
    remoteVersion: null,
    lastChecked: manifest.checkedAt ?? null,
    seededAt,
  };
}

export async function triggerUpdateCheck(): Promise<{ updated: boolean; newVersion?: string }> {
  // Auto-update is not yet wired up — checkUrl is empty in current manifest.
  return { updated: false };
}

function writeManifest(manifest: CriteriaManifest): void {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
}
