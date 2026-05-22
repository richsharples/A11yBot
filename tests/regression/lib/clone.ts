import { execSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * Shallow-clone a GitHub repo to the given directory.
 * No-ops if the directory already exists and looks like a valid clone.
 */
export function ensureCloned(githubUrl: string, targetDir: string): void {
  if (fs.existsSync(path.join(targetDir, ".git"))) {
    console.log(`  ↳ Already cloned: ${path.basename(targetDir)}`);
    return;
  }

  console.log(`  ↳ Cloning ${githubUrl} …`);
  fs.mkdirSync(targetDir, { recursive: true });
  execSync(`git clone --depth 1 --quiet "${githubUrl}" "${targetDir}"`, {
    stdio: "inherit",
    timeout: 60_000,
  });
  console.log(`  ↳ Cloned to ${targetDir}`);
}

/**
 * Returns true if the target directory exists and looks like a git repo.
 */
export function isCloned(targetDir: string): boolean {
  return fs.existsSync(path.join(targetDir, ".git"));
}
