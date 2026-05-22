import path from "path";
import type { TargetConfig } from "./types";

const ROOT = path.resolve(__dirname, "../..");

export const TARGETS: TargetConfig[] = [
  {
    id: "fixture",
    name: "Synthetic a11y fixture",
    sourcePath: path.join(ROOT, "tests/regression/fixtures/bad-a11y"),
    productComponents: ["web", "software"],
    edition: "508",
    description:
      "Committed JSX file with deliberate a11y violations. Exact match — any deviation is a scanner regression.",
    matchMode: "exact",
  },
  {
    id: "a11ybot-self",
    name: "a11ybot (self-scan)",
    sourcePath: ROOT,
    productComponents: ["web", "software"],
    edition: "508",
    description:
      "Scans the a11ybot codebase itself. Tolerance-based — expected to grow as the app evolves.",
    matchMode: "tolerance",
  },
  {
    id: "cmdk",
    name: "cmdk (OSS baseline)",
    sourcePath: path.join(ROOT, "tests/regression/oss/cmdk"),
    githubUrl: "https://github.com/pacocoursey/cmdk",
    cloneDir: "tests/regression/oss/cmdk",
    productComponents: ["web", "software"],
    edition: "508",
    description:
      "Open-source React command palette — external baseline. Run `npm run regression:clone` to set up.",
    matchMode: "tolerance",
  },
];
