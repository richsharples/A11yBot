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
    id: "fixture-int",
    name: "Synthetic a11y fixture (INT edition)",
    sourcePath: path.join(ROOT, "tests/regression/fixtures/bad-a11y"),
    productComponents: ["web", "software"],
    edition: "INT",
    description:
      "Same fixture scanned under the INT criteria set (~160 criteria). Exact match — verifies INT edition criteria seeding and scanner mapping.",
    matchMode: "exact",
  },
  {
    id: "fixture-docs-support",
    name: "Synthetic a11y fixture (Docs + Support components)",
    sourcePath: path.join(ROOT, "tests/regression/fixtures/bad-a11y"),
    productComponents: ["docs", "support"],
    edition: "508",
    description:
      "Same fixture scanned with docs/support components selected. Validates that component scoping correctly marks web/software criteria as notApplicable.",
    matchMode: "exact",
  },
  {
    id: "fixture-all-components",
    name: "Synthetic a11y fixture (all components)",
    sourcePath: path.join(ROOT, "tests/regression/fixtures/bad-a11y"),
    productComponents: ["web", "software", "hardware", "docs", "support"],
    edition: "508",
    description:
      "All five component types selected — ensures no criteria are dropped and the full 508 set is in scope.",
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
