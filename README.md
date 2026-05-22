# VPAT Tool

A local web app for generating **VPAT 2.5 Accessibility Conformance Reports** (ACR). It combines automated accessibility scanning with AI-assisted drafting to evaluate WCAG / Section 508 criteria and produce a `.docx` report ready for submission.

Everything runs locally in a single session — no database, no login, no data leaves your machine (except Anthropic API calls for AI drafting).

---

## Features

- **Source scan** — runs ESLint + `jsx-a11y` rules against a local React/JSX/TSX codebase and maps violations to VPAT criteria
- **AppScan** — runs Lighthouse against a live URL and maps audit failures to VPAT criteria
- **Interview mode** — guided Q&A so a PM can answer plain-language questions for each criterion without needing to read the scanner output
- **AI drafting** — sends criterion definition + evidence to Claude, which produces a conformance level (`Supports`, `Partially Supports`, `Does Not Support`, `Not Applicable`) and the formal vendor remarks paragraph
- **Export** — produces a `.docx` VPAT 2.5 file
- **Editions** — Section 508 and International (EN 301 549 / WCAG 2.1/2.2)

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
git clone https://github.com/your-org/vpat-tool.git
cd vpat-tool
npm install
```

### 2. Run the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Create a project

The setup wizard asks for:

- **Product name, version, description** — appear in the VPAT header
- **Contact name and email** — appear in the VPAT header
- **Anthropic API key** — used for AI drafting; leave blank to use interview-only mode without AI
- **VPAT edition** — Section 508 or International (INT)
- **Input mode** — choose what evidence sources to use:
  - *Interview only* — guided Q&A, no scanner needed
  - *Source scan* — point at a local repository path
  - *AppScan* — point at a live URL (uses Lighthouse)
  - *Hybrid* — source + AppScan + interview

---

## Usage

### Running scans

Once a project is created, use the action bar at the top of the review page:

- **Run source scan** — scans the local repo path you provided; maps ESLint/jsx-a11y violations to criteria
- **Run AppScan** — runs Lighthouse against the URL you provided
- **AI draft all** — sends all unevaluated criteria to Claude for drafting in parallel

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
- **GitHub issue ↗** — copies a pre-formatted GitHub issue body and opens the new-issue page in your repo (enter your repo URL once; it's saved for the session)

### Exporting

Click **Export .docx** in the header to download the completed VPAT. Criteria still marked *Not Evaluated* are written as such — this is acceptable in a draft VPAT.

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
  CriteriaReview.tsx          # Main review UI
  SetupWizard.tsx             # Project setup wizard
src/
  criteria/
    vpat-2.5-508.json         # Section 508 criteria definitions
    vpat-2.5-int.json         # International criteria definitions
  scanners/
    source-jsx.ts             # ESLint/jsx-a11y scanner
    lighthouse.ts             # Lighthouse runner
  ai/
    client.ts                 # Anthropic client
    draft.ts                  # Per-criterion AI orchestration
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

## Notes

- **Session only** — all project state is held in memory. Refreshing the page or restarting the server starts a new session. Export your `.docx` before closing.
- **Anthropic API key** — entered in the setup wizard and stored in memory for the session only. It is never written to disk.
- **Criteria coverage** — the JSON criteria files are a working subset of the full VPAT 2.5 table. Additional criteria can be added by extending `src/criteria/vpat-2.5-508.json` and `vpat-2.5-int.json`.
