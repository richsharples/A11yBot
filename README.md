<p align="center">
  <img src="public/a11ybot-logo.svg" alt="A11yBot logo" width="320" />
</p>

# A11yBot

A local web app for generating **VPAT 2.5 Accessibility Conformance Reports** (ACR). It combines automated accessibility scanning with AI-assisted drafting to evaluate WCAG / Section 508 criteria and produce a `.docx` report ready for submission.

Everything runs locally in a single session — no database, no login, no data leaves your machine (except Anthropic API calls for AI drafting).

---

## Features

- **Scope pre-filtering** — select which component types your product includes (SaaS/Web, Desktop/Mobile, Hardware, Documentation, Support Services); criteria that don't apply are immediately marked N/A so you only review what's relevant
- **Full VPAT 2.5 criteria coverage** — all criteria for both editions: Section 508 (~124 criteria) and International/EN 301 549 (~160 criteria)
- **Source scan** — runs ESLint + `jsx-a11y` rules against a local React/JSX/TSX codebase and maps violations to VPAT criteria
- **Runtime scan** — runs Lighthouse against a live URL and maps audit failures to VPAT criteria
- **Interview mode** — guided Q&A so a PM can answer plain-language questions for each criterion without needing to read the scanner output
- **AI drafting** — sends criterion definition + evidence to Claude, which produces a conformance level (`Supports`, `Partially Supports`, `Does Not Support`, `Not Applicable`) and the formal vendor remarks paragraph
- **Export** — produces a `.docx` VPAT 2.5 file including a Compliance Standards table
- **Editions** — Section 508 (WCAG 2.0 + 36 CFR Part 1194) and International (EN 301 549 V3.2.1 + WCAG 2.0/2.1/2.2)

---

## Requirements

| Requirement | Version |
|---|---|
| Node.js | 20 LTS or later |
| npm | 9+ |
| Anthropic API key | Required for AI drafting ([get one](https://console.anthropic.com)) |

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/richsharples/A11yBot.git
cd A11yBot
npm install
```

### 2. Run the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Create a project

The three-step setup wizard asks for:

**Step 1 — Product & Contact**
- Product name, version, description — appear in the VPAT header
- Contact name and email — appear in the VPAT header
- Anthropic API key — used for AI drafting; leave blank for interview-only mode

**Step 2 — Product Scope**
- Select every component type your product includes; out-of-scope criteria are pre-marked N/A
- Options: SaaS / Web · Desktop / Mobile App · Hardware · Documentation · Support Services

**Step 3 — Edition & Input Mode**
- *Section 508* — US federal procurement (WCAG 2.0 + 36 CFR Part 1194)
- *International (INT)* — Combined 508 + EN 301 549 V3.2.1 + WCAG 2.1/2.2
- Input mode: *Interview only* · *Source scan* · *Runtime scan* · *Hybrid (recommended)*

---

## Usage

### Running scans

Once a project is created, use the action bar at the top of the review page:

- **Run source scan** — scans the local repo path you provided; maps ESLint/jsx-a11y violations to criteria
- **Run runtime scan** — runs Lighthouse against the URL you provided
- **AI draft all** — sends all unevaluated criteria to Claude for drafting in parallel (max 5 concurrent)

Scans clear previous results before adding new ones, so re-running after fixing issues shows clean results.

### Reviewing criteria

1. Select a chapter in the left sidebar (chapters with scanner findings show an orange badge)
2. Select a criterion to open the detail panel
3. Review the evidence (scanner findings with file locations, interview responses)
4. Use **AI Draft** in the evidence banner to generate a conformance assessment, or answer the interview question and click **Answer + AI Draft**
5. Adjust the level and remarks if needed, then **Confirm & save**

### Reporting findings to developers

Each scanner finding has two action buttons:

- **Copy** — copies the finding as plain text for pasting into an email
- **GitHub issue ↗** — copies a pre-formatted GitHub issue body and opens the new-issue page in your repo

### Exporting

Click **Export .docx** in the header to download the completed VPAT. The document includes a Compliance Standards table listing the applicable standards and their versions. Criteria still marked *Not Evaluated* are written as such — acceptable in a draft VPAT.

---

## Available commands

```bash
npm run dev        # Start dev server on http://localhost:5173
npm run build      # Production build
npm run start      # Start production server
npm run lint       # Run ESLint
npm run typecheck  # TypeScript type check (tsc --noEmit)
```

---

## Regression testing

The regression suite detects scanner and export regressions before each release. It runs the tool against three targets and compares results to committed JSON baselines.

### Targets

| Target | Match mode | Purpose |
|---|---|---|
| Synthetic fixture | Exact | Committed JSX with 8 deliberate a11y violations — any scanner drift fails immediately |
| A11yBot (self) | ±20% tolerance | Scans the production codebase — catches if the scanner stops finding things |
| cmdk (OSS) | ±20% tolerance | External React library — baseline against code we don't control |

### One-time setup

Clone the OSS target (only needed once per machine):

```bash
npm run regression:clone
```

### Running the suite

The dev server must be running (`npm run dev` in a separate terminal).

```bash
npm run regression          # compare against baselines — exits 1 on regression
```

Run this before every release. If it passes, tag. If it regresses, fix first.

### Updating baselines

After intentional changes to the scanner or criteria (expected findings change), update the baselines:

```bash
npm run regression:update              # update all targets
npm run regression -- --target fixture # update a single target
```

Then commit the updated files in `tests/regression/baselines/`.

### How regressions are classified

- **Regression (❌)** — export failed, criteria count changed, or scanner found significantly fewer issues than baseline
- **Changed (⚠️)** — counts drifted outside tolerance but no hard failure (investigate before releasing)
- **Improved (📈)** — scanner found more issues than baseline; run `--update-baseline` to accept
- **Pass (✅)** — all checks within tolerance

Run reports are saved to `.regression-reports/` (gitignored) for post-mortem inspection.

---

## Project structure

```
app/
  page.tsx                    # SPA shell
  api/
    project/route.ts          # POST: create in-memory project
    criteria/route.ts         # GET: criteria structure for edition
    criterion/route.ts        # PATCH: update criterion state
    scan/source/route.ts      # POST: source scan (ESLint + jsx-a11y)
    scan/runtime/route.ts     # POST: Lighthouse scan
    ai/draft/route.ts         # POST: AI-draft one or all criteria
    export/route.ts           # POST: build .docx
components/
  review/
    CriteriaReview.tsx        # Main review shell + orchestrator
    CriterionDetail.tsx       # Per-criterion editing panel
    StatusBar.tsx             # Status log at bottom of screen
    FindingActions.tsx        # Copy/GitHub-issue actions per finding
    ProgressBar.tsx           # Evaluated/confirmed progress bar
    Tooltip.tsx               # Lightweight tooltip wrapper
    types.ts                  # Shared types, constants, helpers
  setup/
    SetupWizard.tsx           # Three-step project creation wizard
src/
  criteria/
    vpat-2.5-508.json         # Section 508 criteria (~124 criteria)
    vpat-2.5-int.json         # International criteria (~160 criteria)
  scanners/
    source-jsx.ts             # ESLint/jsx-a11y scanner
    rule-mapping.ts           # Builds ESLint rule → criterion ID mapping
    lighthouse.ts             # Lighthouse runner
  ai/
    client.ts                 # Anthropic client
    draft.ts                  # Per-criterion AI orchestration + deriveConfidence()
  state/
    project.ts                # In-memory project store
  types.ts                    # Zod schemas + TypeScript types
```

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| LLM | Anthropic Claude (`claude-sonnet-4-6`) via `@anthropic-ai/sdk` |
| Source a11y | ESLint 8 + `eslint-plugin-jsx-a11y` |
| Runtime scan | Lighthouse 12 |
| Export | `docx` npm package |
| Validation | Zod |
| Logging | Pino → console + `vpat-run.log.json` |

---

## Local model performance

A11yBot supports local models via [Ollama](https://ollama.com). AI drafting performance varies significantly by model size. Each criterion requires one LLM call; a full 508 run (59 applicable criteria for a web product) can take anywhere from 2 minutes to over an hour depending on the model and hardware.

Tested on Apple Silicon (M-series) and NVIDIA consumer GPUs. Cloud models via OpenRouter are always faster for bulk drafting.

| Model | Size | Speed (tok/s) | Full run estimate | Quality | Notes |
|---|---|---|---|---|---|
| `qwen2.5:3b` | 2 GB | ~35–50 | ~5 min | Good | Best starting point; fast, reliable JSON |
| `phi4-mini:3.8b` | 2.5 GB | ~30–40 | ~7 min | Very good | Excellent instruction following; recommended |
| `gemma3:4b` | 3 GB | ~25–35 | ~8 min | Good | Strong structured output |
| `qwen2.5:7b` | 4.7 GB | ~15–25 | ~15 min | Very good | Better remarks quality than 3b |
| `mistral:7b` | 4.1 GB | ~15–25 | ~15 min | Good | Solid JSON compliance |
| `qwen2.5-coder:14b` | 9 GB | ~8–12 | ~30 min | Excellent | Overkill for VPAT; use 7b instead |

**Tips for faster local drafting:**
- A11yBot automatically uses serial requests (batch size 1) for Ollama, since parallel requests to a single GPU cause VRAM thrashing and are slower
- If inference is slow, run `ollama ps` to confirm the model is running on GPU (`100% GPU`). CPU inference is 10–50× slower
- The `:coder` model variants are optimised for code generation; the base variants (`qwen2.5:7b` not `qwen2.5-coder:7b`) produce better natural-language VPAT remarks
- Pull a model with `ollama pull <model>`, then select it in Settings

---

## Notes

- **Session only** — all project state is held in memory. Refreshing the page or restarting the server starts a new session. Export your `.docx` before closing.
- **Config file** — `~/.a11ybot/config.json` persists contact info, AI defaults, and saved products across sessions. Contact info is automatically saved on first project creation.
- **Scope pre-filtering** — criteria marked N/A at creation can be overridden manually in the review. Creating a new project is the only way to change the component scope selection.

---

## Changelog

### 0.1.0-beta.6
- **Review mode** — "Confirm & Next →" primary button with optimistic save (instant, no round-trip delay); Space shortcut advances through AI-drafted criteria; "Confirm all N/A" bulk button per chapter
- **axe-core runtime scanner** — runs alongside Lighthouse in parallel with zero new dependencies (both already transitive deps); ~3× more accessibility rule coverage
- **AI draft improvements** — `ai-attempted` confidence prevents re-drafting criteria the AI already reviewed; prompt relaxed to make best-effort assessments; Ollama `keep_alive=10m` fixes 10-criteria cutoff; silent API failures now shown as errors
- **OpenRouter** — model list updated to current IDs (`claude-sonnet-4.6`, `gemini-2.5-flash`, etc.); switching provider resets model to a valid default
- **User config** — `~/.a11ybot/config.json` persists contact info, AI defaults, and saved products; contact name/email saved on first project creation; product quick-select in wizard
- **Performance** — pino-pretty worker thread removed (10–50ms saved per save); optimistic confirm removes API wait from review hot path; axe + Lighthouse run in parallel per URL
- **UX polish** — dark header with second action row; auto-scan on project creation; Re-scan button; scanner evidence grouped by rule; N/A chapters dimmed; AI draft progress counter; AppScan elapsed timer; .docx table column widths fixed for Apple Pages/LibreOffice

### 0.1.0-beta.5
- Ollama JSON reliability fix and logo panel theme update

### 0.1.0-beta.4
- Codebase reorganised for second-developer onboarding: `CriteriaReview.tsx` (1106 lines) split into `components/review/` sub-components; `SetupWizard.tsx` moved to `components/setup/`
- `buildRuleMapping` extracted from API route into `src/scanners/rule-mapping.ts`; confidence logic de-duplicated via exported `deriveConfidence()` in `src/ai/draft.ts`
- Dead auto-update code removed from `criteria-store.ts`; `tsconfig.json` excludes cloned OSS test targets
- Added `CONTRIBUTING.md` and `.env.example` for new contributors

### 0.1.0-beta.3
- Regression test suite: three-target runner (`fixture`, `vpat-tool-self`, `cmdk`) with committed JSON baselines; exact-match for synthetic fixture, ±20% tolerance for live codebases; `npm run regression` required before every release

### 0.1.0-beta.2
- Scope pre-filtering: new Step 2 in setup wizard lets you select which component types are present; unselected types are pre-marked N/A (e.g. a web-only product eliminates all 48 hardware criteria)
- Full VPAT 2.5 criteria coverage: Section 508 expanded to ~124 criteria (complete ch4 hardware, ch5 software); International expanded to ~160 criteria (WCAG 2.1 Level A, WCAG 2.2, EN 301 549 Chapters 4–6/11–12)
- `.docx` export now includes a Compliance Standards table with standard names, reference URLs, and versions

### 0.1.0-beta.1
- Initial release: guided setup wizard, interview mode, source scan (ESLint/jsx-a11y), runtime scan (Lighthouse), AI drafting via Claude, `.docx` export
