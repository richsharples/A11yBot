# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A single-binary local web app (`npx vpat-tool`) that helps a product manager produce a VPAT 2.5 Accessibility Conformance Report. It starts a Next.js server on `localhost:5173`, serves a SPA UI, holds all state in memory for the session, and writes a `.docx` + `vpat-run.log.json` to the cwd on export. No database, no auth, no persistence across sessions.

Full requirements are in `VPAT-tool-requirements.md`; the prescriptive build spec (stack choices, data model, flows, prompts) is in `BUILD-SPEC.md`. Read `BUILD-SPEC.md` before making architectural decisions — choices there are deliberate and should not be relitigated without asking.

## Tech stack

| Concern | Choice |
|---|---|
| Runtime | Node.js 20 LTS + TypeScript |
| App framework | Next.js 14 App Router (UI + API routes in one project) |
| Styling | Tailwind + shadcn/ui |
| LLM | `@anthropic-ai/sdk`, default model `claude-sonnet-4-6` |
| .docx generation | `docx` (npm) |
| Source parsing | `@babel/parser` (JSX/TSX), `cheerio` (HTML), `@vue/compiler-sfc` (Vue) |
| Source a11y rules | `eslint` programmatically + `eslint-plugin-jsx-a11y` |
| Runtime scan | `lighthouse` (npm), invoked from API route |
| Logging | `pino` → console + `./vpat-run.log.json` |
| Validation | Zod (criteria files, API payloads, AI output) |

## Commands

```bash
npm run dev        # Next.js dev server
npm run build      # Production build
npm run start      # Start production server (via CLI entrypoint)
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # (test runner TBD)
```

Config lives at `~/.vpat/config.json`. Env vars override: `ANTHROPIC_API_KEY`, `VPAT_MODEL`, `VPAT_PORT`.

## Project layout

```
bin/vpat.ts                     # CLI entrypoint (commander.js) — opens browser, starts Next
app/
  page.tsx                      # SPA shell
  api/
    project/route.ts            # POST: create in-memory project
    scan/source/route.ts        # POST: source scan (eslint + parsers)
    scan/runtime/route.ts       # POST: Lighthouse scan
    ai/draft/route.ts           # POST: AI-draft one criterion
    export/route.ts             # POST: build .docx + finalise log
components/
  review/                       # CriteriaReview and sub-components
    CriteriaReview.tsx          # Main orchestrator shell
    CriterionDetail.tsx         # Per-criterion editing panel
    StatusBar.tsx               # Status log at bottom of screen
    ProgressBar.tsx             # Evaluated/confirmed progress bar
    FindingActions.tsx          # Copy/GitHub-issue actions for scanner findings
    Tooltip.tsx                 # Lightweight tooltip wrapper
    types.ts                    # Shared types, constants, helpers (no JSX)
    index.ts                    # Re-exports CriteriaReview
  setup/
    SetupWizard.tsx             # Three-step project creation wizard
    index.ts                    # Re-exports SetupWizard
src/
  criteria/                     # Static JSON — source of truth for which rows appear
    vpat-2.5-508.json
    vpat-2.5-int.json
  scanners/                     # One file per scanner type
    rule-mapping.ts             # Shared buildRuleMapping() used by scan route
  ai/
    client.ts                   # Anthropic client wrapper
    prompts.ts                  # Prompt templates — version carefully, prompt drift causes regressions
    draft.ts                    # Per-criterion orchestration + deriveConfidence()
  docx/
    render.ts                   # Builds .docx programmatically (no templates directory needed)
  state/
    project.ts                  # Module-level singleton Project store
    log.ts                      # pino instance + run-log writer
  types.ts                      # Zod schemas + inferred TS types
config/default.json
```

## Data model (key types)

```ts
type ConformanceLevel = "supports" | "partial" | "doesNotSupport" | "notApplicable" | "notEvaluated";
type Edition = "508" | "INT";
type InputMode = "source" | "runtime" | "interview" | "hybrid";

// One Project lives in memory. Criteria seeded from the JSON file at project creation.
// CriterionState.confidence: "ai-inferred" (scanner only, yellow banner) |
//   "ai-drafted" (interview answer present) | "pm-confirmed" (PM edited/accepted)
// Every state change is appended as JSON-line to ./vpat-run.log.json (debounced 1s).
```

Full interface definitions are in `BUILD-SPEC.md §4` and will be in `src/types.ts`.

## Criteria JSON files

`src/criteria/vpat-2.5-508.json` and `vpat-2.5-int.json` are the source of truth for which rows appear in the UI and the .docx. The Zod schema lives in `src/types.ts`. Each criterion carries `interviewQuestion` (plain-language PM prompt) and `scannerSignals` (mapping to eslint/axe/Lighthouse rule IDs).

The 508 edition has ~124 criteria; the INT edition has ~160 criteria.

## AI draft flow

`POST /api/ai/draft` gathers criterion definition + all evidence + interview answer, calls Claude with the prompt in `src/ai/prompts.ts`, and Zod-validates the response `{ level, remark, reasoning }`. On parse failure: retry once with a correction message; on second failure: store raw text, set `level = notEvaluated`, surface error in UI. "Draft all" calls the endpoint in parallel, max 5 concurrent.

Scanners never set conformance levels — they only contribute `Evidence[]`. Inference is AI-only.

## .docx export

Builds the .docx programmatically via `src/docx/render.ts` (no templates directory), writes to download + `./vpat-{productName}-{date}.docx`. Criteria still at `notEvaluated` are written as "Not Evaluated" — this is acceptable in a draft VPAT.

## Explicit v1 constraints — do not add without asking

No SSO, multi-user, or database. No persistence across sessions (config file aside). No HTML/web ACR output. No EU-only or WCAG-only editions. No native desktop/mobile scanning. No CI integration. No additional runtime scanners (axe-core, Pa11y). No pluggable LLM providers — Anthropic only. No evidence storage UI beyond inline criterion panel.

## Suggested build order

1. Scaffold: Next.js + TS + Tailwind + Zod + Pino + CLI entrypoint
2. In-memory project store + `POST /api/project` + criteria list UI
3. Interview mode (answer → store evidence, no AI)
4. AI draft endpoint + Anthropic client
5. .docx export with placeholder template
6. Source scanner (eslint + jsx-a11y → evidence)
7. Runtime scanner (Lighthouse → evidence)
8. Polish: real ITI templates, full criteria JSON
