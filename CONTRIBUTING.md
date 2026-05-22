# Contributing to vpat-tool

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20 LTS or later |
| npm | 9+ |
| Anthropic API key | Required for AI drafting features ([get one](https://console.anthropic.com)) |

## Local setup

```bash
git clone https://github.com/richsharples/vpat-tool.git
cd vpat-tool
npm install
cp .env.example .env.local          # add your ANTHROPIC_API_KEY
npm run dev                          # starts on http://localhost:5173
```

## Project orientation

| Path | What it is |
|---|---|
| `app/page.tsx` | SPA shell — two views: SetupWizard and CriteriaReview |
| `app/api/` | Next.js API routes (server-only) |
| `components/review/` | CriteriaReview and all sub-components |
| `components/setup/` | SetupWizard (three-step project creation wizard) |
| `src/` | Server-only modules — state, scanners, AI, docx, types |
| `src/criteria/` | VPAT 2.5 criteria JSON + manifest — the source of truth for all criteria rows |
| `src/state/project.ts` | In-memory project store (single `globalThis.__vpatProject`) |
| `tests/regression/` | Regression test suite — must pass before every release |

> **Important:** `src/` is server-only. Never import from `src/` in client components (`"use client"`). If you need a type, inline it or move it to a shared location.

## Development workflow

### Running the app
```bash
npm run dev          # Next.js dev server on :5173
npm run typecheck    # TypeScript check (no emit)
npm run lint         # ESLint
```

### Before every release
1. Run the regression suite (dev server must be running in a separate terminal):
   ```bash
   npm run regression
   ```
2. If it exits 0, tag and push. If it exits 1, fix the regression first.
3. If you've intentionally changed scanner behaviour or criteria, update the baselines:
   ```bash
   npm run regression:update
   ```
   Then commit the updated files in `tests/regression/baselines/`.

### One-time regression setup (new machine)
Clone the OSS comparison target once:
```bash
npm run regression:clone
```

## Updating criteria

The VPAT 2.5 criteria live in `src/criteria/vpat-2.5-508.json` and `src/criteria/vpat-2.5-int.json`.

- Each criterion has `appliesTo`, `interviewQuestion`, and `scannerSignals` fields — keep all three in sync.
- After editing criteria, run `npm run regression:update` to refresh baselines.
- Bump `criteriaVersion` in `src/criteria/manifest.json` when publishing a criteria change.

## Environment variables

See `.env.example` for the full list. The key ones:

| Variable | Required | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | For AI features | — |
| `VPAT_MODEL` | No | `claude-sonnet-4-6` |
| `VPAT_PORT` | No | `5173` |
| `LOG_LEVEL` | No | `info` |

## Releasing a new version

1. Bump `version` in `package.json` and `APP_VERSION` in `components/setup/SetupWizard.tsx`
2. Add a changelog entry to `README.md`
3. Run `npm run regression` — must pass
4. Commit, tag (`git tag -a vX.Y.Z-betaN -m "..."`), and push tag
