# VPAT Tool — Build Spec v1.0

**Audience:** Claude Code (or any engineer) building the v1.0 implementation.
**Companion doc:** `VPAT-tool-requirements.md` (intent, scope, trade-offs).
**Date:** 2026-05-19

This spec is prescriptive. Where there's a choice, I've made it. If a choice is wrong, push back before reverting — the choices form a coherent stack.

---

## 1. Shape of the thing

A single-binary local web app. The user runs one command (`npx vpat-tool` or after install just `vpat`). It starts a Node server on `localhost:5173`, opens the default browser to that URL, and serves a single-page UI. There is no remote backend, no database, no auth, no Docker. Closing the terminal stops the tool. State lives in memory for the duration of the run; on export, a `.docx` and a `vpat-run.log.json` are written to the current working directory.

The user does three things in the UI: (1) pick a VPAT edition (508 or INT) and an input mode (Source / Runtime / Interview / Hybrid), (2) feed the tool the inputs it needs for that mode, (3) walk through every applicable criterion, accept or edit the AI-drafted answers, and click Export. There's no save button — the in-memory state is the source of truth until export.

---

## 2. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Runtime | **Node.js 20 LTS + TypeScript** | One language end-to-end; matches Lighthouse and the axe/Pa11y/eslint ecosystem. |
| App framework | **Next.js 14 (App Router)** | Single project for UI + API routes; fewer moving parts than separate frontend/backend. |
| Styling | **Tailwind + shadcn/ui** | Decent defaults, accessible primitives, no design debate needed. |
| LLM | **Anthropic TS SDK** (`@anthropic-ai/sdk`), default model `claude-sonnet-4-6` | Quality fits the drafting task; user supplies key. OpenAI fallback in a follow-up release — don't build the abstraction yet. |
| .docx generation | **`docx`** (npm) | Pure JS, programmatic. Cleaner than docxtemplater for our shape of output. |
| Source parsing | **`@babel/parser`** for JSX/TSX, **`cheerio`** for HTML, **`@vue/compiler-sfc`** for Vue. Angular templates v1: regex-level heuristics only. | Skip Angular's compiler; it's heavy and most Cellebrite-style products are React/Vue anyway. |
| Source a11y rules | **`eslint`** programmatically with **`eslint-plugin-jsx-a11y`** preset | Reuse the canonical rule set; do not reimplement. |
| Runtime scan | **`lighthouse`** (npm), invoked from an API route | Decided in requirements. axe-core can be added later. |
| Logging | **`pino`** with `pino-pretty` to console, file sink to `./vpat-run.log.json` | Structured JSON, easy to ship to a vendor later. |
| Validation | **Zod** | Schema for criteria files, API payloads, and AI output. |
| Process model | Server + browser in the same Node process. The CLI entrypoint just calls `next start` after writing a temp config. | Easy to package as one binary. |

Project layout:

```
vpat-tool/
  bin/
    vpat.ts                 # CLI entrypoint (commander.js)
  app/                      # Next.js App Router
    page.tsx                # Single-page UI shell
    api/
      project/route.ts      # POST: create in-memory project from inputs
      scan/source/route.ts  # POST: run source scan
      scan/runtime/route.ts # POST: run Lighthouse
      ai/draft/route.ts     # POST: AI drafts one criterion
      export/route.ts       # POST: build .docx + log, return as download
  src/
    criteria/               # Static data (JSON), see §5
      vpat-2.5-508.json
      vpat-2.5-int.json
    scanners/
      source-jsx.ts
      source-html.ts
      source-vue.ts
      source-angular.ts
      source-css.ts
      lighthouse.ts
    ai/
      client.ts             # Anthropic client wrapper
      prompts.ts            # Prompt templates (see §7)
      draft.ts              # Per-criterion drafting orchestrator
    docx/
      render.ts             # Build the .docx from project state
      templates/            # python-style placeholders, plain Word XML
    state/
      project.ts            # In-memory project store (single Map)
      log.ts                # pino instance + run-log writer
    types.ts                # Zod schemas + inferred TS types
  config/
    default.json            # Defaults; reads ~/.vpat/config.json if present
  README.md
  package.json
  tsconfig.json
```

---

## 3. Run UX

End-user, first run:

```
$ npx vpat-tool
vpat 1.0.0
Reading config: ~/.vpat/config.json (not found — using defaults)
ANTHROPIC_API_KEY: not set
  ➜ Paste an Anthropic key now, or press Enter to skip and run interview-only:
> sk-ant-...
Saved to ~/.vpat/config.json. Starting server...
  ➜ http://localhost:5173 (opening browser)
  ➜ Logs streaming to ./vpat-run.log.json
  ➜ Ctrl-C to quit
```

Second-run UX is identical minus the prompt — config exists, browser opens, done.

The `~/.vpat/config.json` shape:

```json
{
  "anthropicApiKey": "sk-ant-...",
  "model": "claude-sonnet-4-6",
  "port": 5173,
  "openBrowser": true
}
```

Env vars override config: `ANTHROPIC_API_KEY`, `VPAT_MODEL`, `VPAT_PORT`.

---

## 4. In-memory data model

One `Project` exists at a time. The server holds it in a module-level singleton.

```ts
type ConformanceLevel = "supports" | "partial" | "doesNotSupport" | "notApplicable" | "notEvaluated";

type Edition = "508" | "INT";

type InputMode = "source" | "runtime" | "interview" | "hybrid";

interface Evidence {
  source: "source-scan" | "runtime-scan" | "interview" | "manual";
  detail: string;             // human-readable summary
  ref?: string;               // file:line or URL+selector
  rawId?: string;             // scanner rule id (axe/eslint/Lighthouse audit)
  capturedAt: string;         // ISO timestamp
}

interface CriterionState {
  id: string;                 // e.g. "508.302.1" or "wcag.1.1.1"
  level: ConformanceLevel;
  remark: string;
  confidence: "ai-inferred" | "ai-drafted" | "pm-confirmed";
  evidence: Evidence[];
  history: { at: string; level: ConformanceLevel; remark: string }[];
}

interface Project {
  id: string;                 // generated; ephemeral
  productName: string;
  productVersion: string;
  productDescription: string;
  contactName: string;
  contactEmail: string;
  edition: Edition;
  mode: InputMode;
  sourcePath?: string;        // absolute path the user selected
  runtimeUrl?: string;        // URL Lighthouse scanned
  createdAt: string;
  criteria: Record<string, CriterionState>;
}
```

**The run log** is the same project object, serialised on every state-changing API call (debounced 1s), appended as JSON-lines to `./vpat-run.log.json`. On crash, you can replay the log to recover state. v1 does not implement replay — the log is for audit and debugging.

---

## 5. Criteria data files

Two JSON files in `src/criteria/`. They are the source of truth for which rows appear in the UI and the .docx. The starter versions (this repo) ship with the structure complete and the criterion text filled in for the 508 chapters and WCAG A/AA. The full INT cross-reference table is a follow-on data task — see §11.

Schema (Zod-defined in `src/types.ts`):

```ts
interface CriteriaFile {
  edition: "508" | "INT";
  version: "2.5";
  generatedFrom: string;        // "ITI VPAT 2.5, Nov 2023"
  chapters: Chapter[];
}

interface Chapter {
  id: string;                   // "ch3", "ch5", "wcag-a", etc.
  title: string;
  description?: string;
  criteria: Criterion[];
}

interface Criterion {
  id: string;                   // "508.302.1", "wcag.1.1.1"
  ref: string;                  // ITI label, e.g. "302.1 With Vision"
  text: string;                 // the criterion text itself
  appliesTo: ("software" | "web" | "docs" | "support" | "hardware")[];
  // For INT only — which other standards' criteria this row also satisfies
  crossRefs?: { standard: "508" | "EN301549" | "WCAG"; id: string }[];
  // Hints for the AI and the interviewer
  interviewQuestion?: string;
  scannerSignals?: {
    eslintRules?: string[];
    axeRules?: string[];
    lighthouseAudits?: string[];
  };
}
```

Example row, illustrative:

```json
{
  "id": "wcag.1.1.1",
  "ref": "1.1.1 Non-text Content (Level A)",
  "text": "All non-text content presented to the user has a text alternative that serves the equivalent purpose.",
  "appliesTo": ["web", "software"],
  "interviewQuestion": "Do all images, icons, and non-text UI elements in your product have appropriate text alternatives (alt text, aria-label, etc.)? Are decorative images marked so screen readers skip them?",
  "scannerSignals": {
    "eslintRules": ["jsx-a11y/alt-text", "jsx-a11y/img-redundant-alt"],
    "axeRules": ["image-alt", "input-image-alt", "area-alt"],
    "lighthouseAudits": ["image-alt"]
  }
}
```

A starter `vpat-2.5-508.json` is checked into this folder alongside the spec; see §11 for what's still TODO.

---

## 6. Core flows

### 6.1 Create project

`POST /api/project` accepts product metadata + edition + mode. Server builds a `Project`, seeds `criteria` with one `CriterionState` per criterion in the chosen edition (all start at `notEvaluated`, empty remark), returns the project. UI navigates to the run screen.

### 6.2 Source scan

`POST /api/scan/source` with `{ sourcePath: "/abs/path/to/repo" }`. Server:

1. Walks the path with `fast-glob`, ignoring `node_modules`, `dist`, `.git`.
2. Runs `eslint` programmatically with `eslint-plugin-jsx-a11y:recommended` against `.jsx/.tsx`. Captures violations.
3. Runs `cheerio` over `.html` files for the same rule shapes (missing alt, missing labels, heading order).
4. Runs `@vue/compiler-sfc` over `.vue` files and inspects template ASTs.
5. Regex passes over `.ts/.html` Angular templates for the cheap wins (`*ngIf` on focusable elements, missing `aria-*`, etc.). Documented limitation.
6. Stylelint pass over `.css/.scss` with a contrast plugin if available; otherwise skip and let the runtime scan catch contrast.

Each violation is mapped to one or more criterion IDs via `scannerSignals.eslintRules`. The result is a `Map<criterionId, Evidence[]>` which the server stores in the project. The UI surfaces evidence next to each criterion. Source scan never sets a conformance level on its own — it only contributes evidence. Inference happens in the AI draft step.

### 6.3 Runtime scan

`POST /api/scan/runtime` with `{ url: "https://...", paths?: string[], headers?: Record<string,string> }`. Server invokes Lighthouse programmatically (`lighthouse(url, opts, config)`) with the accessibility category only. For each path supplied, scan separately, merge findings. Lighthouse audit IDs are mapped to criteria via `scannerSignals.lighthouseAudits`. Same evidence-only contract as source scan.

Auth is v1-naive: the user can supply `headers` (typically a `Cookie` or `Authorization` value they copied from their browser). No auth flow.

### 6.4 AI draft

`POST /api/ai/draft` with `{ criterionId: string }`. Server gathers the criterion definition, all evidence collected for it, the interview answer if one exists, and the product metadata, and sends them to Claude with the prompt template in §7. The response is parsed (Zod-validated) into `{ level, remark, confidence, reasoning }`. The server merges this into `CriterionState`:

- If there is **only scanner evidence**, `confidence = "ai-inferred"` and the UI shows a yellow "AI inferred — please confirm" banner.
- If there is an **interview answer**, `confidence = "ai-drafted"` — the PM authored the substance, AI just shaped the wording.
- The PM can edit either field; on save, `confidence` becomes `"pm-confirmed"`.

A "draft all" button calls this endpoint in parallel (max 5 concurrent) for every `notEvaluated` criterion in the project.

### 6.5 Interview

The UI presents each criterion's `interviewQuestion` with a free-text answer box and an "I don't know — let me skip" button. Skipping leaves the criterion at `notEvaluated`. Answering it stores an `Evidence` of source `"interview"` and triggers `/api/ai/draft` automatically. The PM sees the AI's draft level + remark and can accept, edit, or reject.

### 6.6 Export

`POST /api/export` returns a `.docx` as a download and writes the final run log. The docx renderer (`src/docx/render.ts`):

1. Loads a Word template (`src/docx/templates/vpat-2.5-{edition}.docx`) — the ITI template with placeholder tags.
2. Fills the product metadata header.
3. For each chapter and criterion, writes a table row: `[ref + text] [level (formatted)] [remark]`. Criteria still at `notEvaluated` are written as "Not Evaluated" with a remark noting that — this is honest and acceptable in a draft VPAT.
4. Writes the file to the user's downloads via the browser; also stamps a copy at `./vpat-{productName}-{date}.docx` in the cwd.

---

## 7. AI prompt structure

One system prompt, one user prompt template per draft call. Keep these in `src/ai/prompts.ts` and version them — prompt drift is the most likely cause of regressions.

**System prompt** (skeleton — tune during build):

> You are an accessibility analyst drafting one row of a VPAT 2.5 Accessibility Conformance Report. You will receive: the criterion's official text, evidence collected from automated scanners, and (optionally) a product manager's free-text answer about how their product handles this criterion. Your job is to (1) pick exactly one conformance level from `supports`, `partial`, `doesNotSupport`, `notApplicable`, or `notEvaluated`, (2) draft the Remarks/Explanations text in the voice of a vendor-authored ACR: factual, third-person, no marketing language, 1–4 sentences. Rules: never claim `supports` on the basis of scanner evidence alone — scanners cannot prove conformance, only detect failures. If the scanner found violations, the level is `partial` or `doesNotSupport`. If there is no evidence at all, return `notEvaluated`. If the PM's answer indicates the criterion does not apply to the product, return `notApplicable` and explain why. Output JSON only, matching the schema provided.

**User prompt template:**

```
PRODUCT: {productName} {productVersion}
DESCRIPTION: {productDescription}

CRITERION ID: {criterion.id}
CRITERION REF: {criterion.ref}
CRITERION TEXT: {criterion.text}

EVIDENCE FROM SCANNERS ({evidence.length} items):
{each evidence: "- [source] [rawId] detail — ref"}

PM ANSWER (interview):
{pmAnswer or "(none)"}

Respond with JSON:
{
  "level": "supports" | "partial" | "doesNotSupport" | "notApplicable" | "notEvaluated",
  "remark": string,
  "reasoning": string  // not shown to user, kept for audit log
}
```

The response is parsed with Zod. If parsing fails, retry once with a "your previous output was not valid JSON, please return only JSON matching the schema" follow-up; on second failure, store the raw text as the remark, set `level = notEvaluated`, and surface an error in the UI.

---

## 8. .docx renderer

The ITI .docx template is the single source of truth for layout. Steps:

1. Download the official VPAT 2.5 508 template from ITI (`https://www.itic.org/policy/accessibility/vpat`) and the INT template. Strip them down: remove example text, keep table structure.
2. Add named bookmarks for the metadata fields (product name, version, description, date, contact).
3. Each criteria table row gets a Word content control with the criterion id as its tag, so the renderer can find it and insert level + remark.
4. The `docx` npm package opens the template, fills bookmarks, populates content controls, and writes the output.

Keep the template files in `src/docx/templates/` and treat them as build artefacts — version them with the code. If ITI publishes VPAT 2.6, that's a template update plus a criteria JSON update; no code change needed.

---

## 9. Logging

`pino` instance with two destinations:

- Console (pretty-printed during dev) — for the terminal.
- File: `./vpat-run.log.json` — JSON lines, one per state-changing event. Events: `project.created`, `scan.source.started/finished`, `scan.runtime.started/finished`, `ai.draft.requested/returned`, `criterion.updated.by.pm`, `export`. Every event includes `criterionId` when relevant and a full snapshot of the criterion state after the change. This is the audit trail; a third-party reviewing the VPAT can read this log to see what the AI said, what the PM changed, and when.

Logs are rotated at 50MB. Single file in cwd is fine for v1.

---

## 10. Things v1 explicitly does not do

Carrying forward from requirements, restated so Claude Code doesn't try to "helpfully" add them:

No SSO. No multi-user. No database. No persistence across sessions (config aside). No HTML/web ACR output. No EU-only or WCAG-only editions. No native desktop or mobile scanning. No CI integration. No diffs between VPAT versions. No evidence storage UI beyond what fits inline in the criterion panel. No additional runtime scanners (axe-core, Pa11y). No pluggable LLM providers — Anthropic only in v1.

---

## 11. Pre-build data tasks

These are not code, but they are blocking for a useful v1. Order of priority:

1. **Extract the full VPAT 2.5 508 criteria list** from the ITI template into `src/criteria/vpat-2.5-508.json`. The starter file ships with Chapter 3 and the WCAG A/AA tables filled in; Chapters 4 (Hardware, mostly N/A for SaaS), 5 (Software), and 6 (Support Docs) need their criteria text and `interviewQuestion` written. ~60 rows total.
2. **Build the INT cross-reference table** in `src/criteria/vpat-2.5-int.json`. INT is the union of 508 + EN 301 549 + WCAG with cross-refs between equivalent criteria — the JSON shape in §5 supports this via `crossRefs`. ~120 rows total.
3. **Strip and prepare the ITI .docx templates** for both editions, with bookmarks and content controls as described in §8.
4. **Author the `interviewQuestion` and `scannerSignals` fields** for every criterion. This is the highest-leverage content work in the project — good interview questions and accurate scanner mappings are what make the tool feel useful rather than mechanical.

Items 1, 2, and 4 are roughly a day's careful work by someone who knows VPATs. Item 3 is half a day of fiddly Word manipulation.

---

## 12. Suggested build order

A walking skeleton, in order, each step running end-to-end before the next:

1. Project scaffold: Next.js + TS + Tailwind + Zod + Pino. CLI entrypoint that opens browser. (~½ day)
2. In-memory project store, `POST /api/project`, basic UI to create a project and see criteria listed. Hardcode a tiny criteria JSON to start. (~½ day)
3. Interview mode end-to-end: answer a question, store evidence, no AI yet. (~½ day)
4. AI draft endpoint + Anthropic client, working against the interview answer only. (~1 day)
5. .docx export with placeholder template. (~1 day)
6. Source scanner: eslint + jsx-a11y, mapping evidence to criteria. (~1 day)
7. Runtime scanner: Lighthouse integration. (~1 day)
8. Polish, real ITI templates, full criteria JSON. (~2 days)

Total: ~7–8 working days for a single engineer, assuming the pre-build data tasks land in parallel.

---

## 13. Out-of-scope decisions that Claude Code should not relitigate

If Claude Code wants to add SSO, swap to a different stack, introduce a database, build a pluggable LLM abstraction, or add EU-only edition support — it should ask first, not just do it. These are deliberate v1 cuts and the reasoning is in §10 of the requirements doc.
