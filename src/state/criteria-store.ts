import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { log } from "./log";

const STORE_DIR = join(homedir(), ".vpat", "criteria");
const MANIFEST_FILENAME = "manifest.json";
const MANIFEST_PATH = join(STORE_DIR, MANIFEST_FILENAME);
const BUNDLED_DIR = join(process.cwd(), "src", "criteria");
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

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

  const manifest = readManifest();
  const lastChecked = manifest.checkedAt ? new Date(manifest.checkedAt).getTime() : 0;
  if (manifest.checkUrl && Date.now() - lastChecked > CHECK_INTERVAL_MS) {
    await checkForUpdates(manifest);
  }
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
  await ensureCriteriaStore();
  const manifest = readManifest();
  if (!manifest.checkUrl) return { updated: false };
  return checkForUpdates(manifest);
}

async function checkForUpdates(localManifest: CriteriaManifest): Promise<{ updated: boolean; newVersion?: string }> {
  const nowIso = new Date().toISOString();
  try {
    log.info({ event: "criteria-store.checking", url: localManifest.checkUrl });
    const res = await fetch(localManifest.checkUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "vpat-tool/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const remote: CriteriaManifest = await res.json();

    if (remote.criteriaVersion !== localManifest.criteriaVersion) {
      log.info({ event: "criteria-store.update-found", from: localManifest.criteriaVersion, to: remote.criteriaVersion });

      for (const [edition, info] of Object.entries(remote.editions)) {
        if (!info.downloadUrl) continue;
        try {
          const fileRes = await fetch(info.downloadUrl, { signal: AbortSignal.timeout(15000) });
          if (fileRes.ok) {
            writeFileSync(join(STORE_DIR, info.file), await fileRes.text(), "utf-8");
            log.info({ event: "criteria-store.downloaded", edition, version: remote.criteriaVersion });
          }
        } catch (err) {
          log.warn({ err, edition }, "Failed to download criteria file");
        }
      }

      writeManifest({ ...remote, checkedAt: nowIso });
      log.info({ event: "criteria-store.updated", version: remote.criteriaVersion });
      return { updated: true, newVersion: remote.criteriaVersion };
    }

    writeManifest({ ...localManifest, checkedAt: nowIso });
    log.info({ event: "criteria-store.up-to-date", version: localManifest.criteriaVersion });
    return { updated: false };
  } catch (err) {
    log.warn({ err }, "Criteria update check failed (non-fatal)");
    try { writeManifest({ ...localManifest, checkedAt: nowIso }); } catch {}
    return { updated: false };
  }
}

function writeManifest(manifest: CriteriaManifest): void {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
}
