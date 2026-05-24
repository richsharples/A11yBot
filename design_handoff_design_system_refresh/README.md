# Handoff: A11yBot — Design System Refresh

## Overview

A11yBot today runs **two design languages on one screen** — a phosphor-green CRT terminal in the header / status bar / setup left rail, and a generic shadcn-light UI everywhere else. This handoff replaces both with a single, professional, ink-on-paper design language using a navy brand and a single bright-blue accent — the **"Professional Blue"** direction.

The existing codebase (Next.js 14 App Router + Tailwind + TypeScript) implements all the functionality already. **Do not change behavior, routes, state model, APIs, or the 3-pane review IA.** This is a paint job: tokens, components, and the logo.

A full audit (what's broken and why) and the proposed system (palette, type, components, redesigned screens) are bundled as HTML alongside this README. Open them in a browser:

- **`A11yBot Design Review.html`** — the audit. Read this for context.
- **`A11yBot Direction · Professional Blue.html`** — the spec. Read this carefully. The redesigned review screen in §05 is the target.

> The HTML files are **design references**, not production code to copy directly. The task is to recreate them in the existing Next.js / Tailwind / React codebase using its established patterns.

---

## Suggested prompt to paste into Claude Code

```
I'm refactoring the visual design of this Next.js app (A11yBot — a VPAT
generator). The full spec is in design_handoff_design_system_refresh/.
Please:

1. Read design_handoff_design_system_refresh/README.md end-to-end.
2. Open the two .html files in a browser (or grep through them) to get a
   feel for the target visuals.
3. Walk through the refactor in the order listed in the README, pausing
   after each step so I can review before you move on.

Do not change app behavior, API routes, state shape, the 3-pane IA, the
keyboard model, or the workflow. This is paint and naming only.

Start with Step 1 (tokens) and show me a diff before touching any
component.
```

---

## Fidelity

**High-fidelity.** Exact hex values, type sizes, spacing, and component anatomy are specified. Match them. Reach for `design_handoff_design_system_refresh/code/tokens.css` for the canonical palette — don't re-derive from the HTML.

---

## What's in this bundle

```
design_handoff_design_system_refresh/
├── README.md                                     ← you are here
├── A11yBot Design Review.html                    ← the audit (context)
├── A11yBot Direction · Professional Blue.html    ← the spec (target)
└── code/
    ├── tokens.css                  ← drop-in replacement for globals.css :root
    ├── Logo.tsx                    ← drop-in vector logo (3 variants)
    └── tailwind.config.snippet.ts  ← merge into tailwind.config.ts
```

---

## Refactor order — seven steps, ~4–5 days

### Step 1 — Tokens (½ day)

**Goal:** every later step reads colors and type from named tokens.

1. Replace the `:root` block in **`app/globals.css`** with the contents of `code/tokens.css`. This keeps shadcn aliases (`--background`, `--primary`, etc.) working via a shim so existing utility classes don't break.
2. Merge `code/tailwind.config.snippet.ts` into **`tailwind.config.ts`** — replace the existing `extend.colors`, add `fontFamily`, replace `borderRadius`.
3. Add Plex from Google Fonts to **`app/layout.tsx`**:
   ```tsx
   import { IBM_Plex_Sans, IBM_Plex_Mono, IBM_Plex_Serif } from "next/font/google";
   const sans  = IBM_Plex_Sans  ({ subsets:["latin"], weight:["400","500","600","700"], variable:"--font-sans"  });
   const mono  = IBM_Plex_Mono  ({ subsets:["latin"], weight:["400","500","600"],       variable:"--font-mono"  });
   const serif = IBM_Plex_Serif ({ subsets:["latin"], weight:["400","500","600"],       variable:"--font-serif" });
   // ...
   <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`}>
   <body className="min-h-screen bg-surface text-ink-2 font-sans antialiased">
   ```
4. Run `npm run dev` and confirm the app loads with a different baseline color (a hint of cool off-white instead of pure white). The dark terminal header will still be dark — we'll repaint it in Step 5.

**Stop here and have me review the build.** ~60% of the perceived quality lift lands at this step alone.

---

### Step 2 — Logo (½ day)

**Goal:** swap the bitmap logo for vector, render at 16px favicon.

1. Drop **`code/Logo.tsx`** into `components/Logo.tsx`.
2. Replace every `<img src="/a11ybot-logo.png" ...>` with `<Logo />` or `<LogoLockup />`. Grep: `a11ybot-logo`.
   - The big mark in `SetupWizard` left rail → `<LogoLockup size={48} />` (or larger; you can scale)
   - The header brand in `CriteriaReview` → `<LogoLockup size={20} />`
3. Add a `public/favicon.svg`. Source: use the SVG inside `Logo.tsx`'s `<Logo>` component, hard-coded with the brand hex `#0B1B33` body and `#1F6FEB` eyes (so it doesn't depend on CSS variables in the browser tab).
4. Update `app/layout.tsx` metadata icon if needed.
5. Delete `public/a11ybot-logo.png`.

---

### Step 3 — Button component (½ day)

**Goal:** four button variants replace ~7 inline button styles.

Create **`components/ui/Button.tsx`** with these variants. Match the spec exactly:

| Variant     | Tailwind                                                                              | When to use                                                |
|-------------|---------------------------------------------------------------------------------------|------------------------------------------------------------|
| `primary`   | `bg-accent text-white hover:bg-accent-hover border border-accent`                     | One per screen. The next required step.                    |
| `secondary` | `bg-surface text-ink-1 border border-rule hover:bg-surface-2`                         | Alternates, back-paths, "Save only", "Re-draft", "Re-scan" |
| `ghost`     | `text-ink-2 hover:bg-surface-2 px-1.5`                                                | Link-equivalent low-weight actions                         |
| `danger`    | `text-issue hover:bg-issue-bg px-1.5` (text-only — never solid red)                   | Reset / Discard                                            |

All four share: `font-medium text-[13.5px] leading-none px-4 py-2.5 rounded-md inline-flex items-center gap-1.5 disabled:opacity-50`.

Then grep the codebase for `<button` and replace every one of these classes with the new component:

- `bg-blue-600` / `bg-blue-700` → `<Button variant="primary">`
- `bg-green-600` / `bg-green-700` → `<Button variant="primary">` **(save/confirm is now blue, not green)**
- `bg-orange-700` / `bg-orange-800` → `<Button variant="secondary" className="border-issue text-issue">` (or a dedicated `Banner.Action` if you'd rather)
- `bg-white border-gray-300` → `<Button variant="secondary">`
- `bg-gray-100 text-gray-700` → `<Button variant="ghost">` or `secondary`
- `bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14]/70` (header chrome) → `<Button variant="secondary">` once the header is repainted in Step 5

**Files to touch:** `components/review/CriterionDetail.tsx`, `components/review/CriteriaReview.tsx`, `components/setup/SetupWizard.tsx`, `components/settings/SettingsPanel.tsx`.

---

### Step 4 — Chip / Badge / Banner components (½ day)

**Goal:** three components replace ~5 ad-hoc badge families.

Create **`components/ui/Chip.tsx`** for conformance levels. One per `ConformanceLevel`. Mono, 11px, uppercase, tracking-wide:

```tsx
<Chip level="supports" />  // ok-bg / ok / ok-rule
<Chip level="partial" />   // warn-bg / warn / warn-rule
<Chip level="doesNot" />   // issue-bg / issue / issue-rule
<Chip level="na" />        // surface-2 / ink-3 / rule
<Chip level="notEvaluated" /> // transparent / ink-4 / ink-5 dashed
```

Create **`components/ui/Badge.tsx`** for evidence and state. Pill shape, 11.5px, semantic color + mono icon:

```tsx
<Badge variant="issue"   icon="!">4 issues</Badge>
<Badge variant="accent"  icon="✎">Interviewed</Badge>
<Badge variant="warn"    icon="~">AI inferred</Badge>
<Badge variant="ok"      icon="✓">PM confirmed</Badge>
<Badge variant="neutral" icon="v">508 · v2.5</Badge>
```

Create **`components/ui/Banner.tsx`** for `issue` and `warn` callouts in `CriterionDetail`. Anatomy:
- 16px padding
- 8px radius
- Colored background + matching border
- Inline circular icon (currentColor circle, white glyph inside)
- Optional action button on the right

Replace usages in:
- `CriterionDetail.tsx` — the orange "X issues detected" banner → `<Banner variant="issue">` with an action `<Button variant="secondary">AI draft from findings</Button>`
- `CriterionDetail.tsx` — the yellow "AI inferred" banner → `<Banner variant="warn">`
- `CriteriaReview.tsx` — the inline chapter chips (`bg-orange-100 text-orange-700`, `bg-blue-100`, `bg-yellow-100`) → `<Badge variant="...">`
- `CriteriaReview.tsx` — the level badge in each criterion row (`LEVEL_COLORS` map) → `<Chip level={cs.level} />`

Delete or shrink the `LEVEL_COLORS` and `getEvidenceSignal` helpers in `components/review/types.ts` — the new components subsume them.

---

### Step 5 — Header, sidebar, status bar (1 day)

**Goal:** rebuild the dark-phosphor chrome on the new paper surface. This is the most visible single change.

In **`components/review/CriteriaReview.tsx`**:

1. **Header.** Drop all `bg-[#0b1a0d]` and `text-[#39FF14]/N` classes. New header pattern (matches §05 in `A11yBot Direction · Professional Blue.html`):
   - `bg-surface border-b border-rule px-6 pt-3.5`
   - Row 1: `<LogoLockup size={20} />` + version pill + vertical rule + labeled metadata (`Product: Acme 3.4.1` with the label in `eyebrow` style, value in `text-ink-1 font-medium`) + progress cluster on the right
   - Row 2: tab spine (`Criteria review` / `Evidence` / `Settings`) with `border-b-2 border-accent` under the active tab, then a flex spacer and the action cluster: ghost `Re-scan`, secondary `AI draft all <12>`, primary `Create report ↓`
   - Progress bar: `h-1.5 bg-surface-3 rounded-full` with an inner `bg-accent` fill. No more phosphor glow.
   - Nav cluster: `<button class="rd-nav">‹ ›</button>` becomes a single bordered group; secondary style.

2. **Chapter sidebar** (left column, currently 256px). Add chapter numbers (`02`, `03`, `04`...) in a 22px mono left column. Replace `border-l-blue-500` selection with `bg-accent-soft border-l-2 border-accent`. The "Not applicable" sub-label drops the orange/yellow chip family and uses the new `<Badge variant="issue">7 issues pending</Badge>` only when there are scanner findings.

3. **Status bar.** This is the one piece that loses the most. Move it from CRT phosphor to a quiet inline strip:
   - `bg-surface-2 border-t border-rule text-ink-2`
   - `font-mono text-[12px]` for timestamps, `text-[13px] font-sans` for messages
   - Replace the `levelStyle` / `badgeIcon` map: `info` → 7px `bg-ok` dot, `warn` → `bg-warn` dot, `error` → `bg-issue` dot, `running` → small spinner. No filled badge chips inside.
   - Clear button becomes a `<Button variant="ghost">`
   - Collapse caret moves to the left, where the user expects it.

4. **"New project" confirmation modal.** Move it onto surface:
   - `bg-surface border border-rule rounded-xl shadow-xl` (no more dark phosphor)
   - Title in `text-title text-ink-1`, body in `text-body text-ink-2`
   - Buttons: secondary `Cancel`, danger-text `Discard & start new` — **no solid red**
   - This is the one place where staying restrained matters most. Destructive confirmation should feel grave, not styled.

---

### Step 6 — SetupWizard left rail (½ day)

**Goal:** repaint the setup wizard's "phosphor identity panel."

In **`components/setup/SetupWizard.tsx`**:

1. The whole left rail (`bg-[#0b1a0d]`) → `bg-surface-2 border-r border-rule text-ink-2`
2. Logo → `<LogoLockup size={48} />`
3. Version pill → `bg-surface-3 text-ink-3 font-mono text-[11px]`
4. "Compliance Standards" panel → standard list on paper:
   - Eyebrow label (`Compliance Standards`) in `eyebrow` style
   - Source items: `<Badge variant="neutral">{abbr}</Badge>` followed by an underlined link in `text-ink-1`
   - Notes block: `bg-warn-bg border border-warn-rule rounded p-3 text-warn` for the criteria notes
5. Right-side step indicator: keep the same `StepDot` shape but update colors:
   - Active: `bg-accent text-white`
   - Done: `bg-ok text-white`
   - Pending: `bg-surface-3 text-ink-3`
6. All form buttons (`btnPrimary`, `btnSecondary`) → `<Button variant="primary|secondary">`. Delete the local class constants.
7. `RadioCard` / `ProviderCard` selection state: `border-accent bg-accent-soft` (currently `border-blue-500 bg-blue-50` — still blue, but use the tokens).

---

### Step 7 — Dark mode (½–1 day)

**Goal:** ship a working dark theme using the same token graph. The `.dark` block is already in `tokens.css` from Step 1 — this step wires up the toggle.

Your existing `tailwind.config.ts` already has `darkMode: ["class"]`, so Tailwind utility classes that use the `dark:` prefix will respond automatically when `<html>` gets `class="dark"`. **But because almost everything uses CSS variables, you barely need `dark:` prefixes anyway** — the variables resolve to the dark values whenever the class is set.

1. **Anti-FOUC boot script.** Add this to `app/layout.tsx`, inside `<head>`, before `<body>`. It must be inline (not a separate file) so it runs before first paint:
   ```tsx
   <head>
     <script
       dangerouslySetInnerHTML={{
         __html: `
(function(){
  try {
    var stored = localStorage.getItem('a11ybot-theme');
    var prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored || (prefers ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
    document.documentElement.dataset.theme = theme;
  } catch(e){}
})();
         `,
       }}
     />
   </head>
   ```

2. **`useTheme` hook** at `components/useTheme.ts`:
   ```ts
   "use client";
   import { useEffect, useState, useCallback } from "react";

   export type Theme = "light" | "dark" | "system";

   export function useTheme() {
     const [theme, setThemeState] = useState<Theme>("system");

     useEffect(() => {
       const stored = (localStorage.getItem("a11ybot-theme") as Theme) ?? "system";
       setThemeState(stored);
     }, []);

     const apply = useCallback((next: Theme) => {
       const root = document.documentElement;
       const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
       const effective = next === "system" ? (prefers ? "dark" : "light") : next;
       root.classList.toggle("dark", effective === "dark");
       root.dataset.theme = next;
     }, []);

     const setTheme = useCallback((next: Theme) => {
       setThemeState(next);
       localStorage.setItem("a11ybot-theme", next);
       apply(next);
     }, [apply]);

     // Follow OS changes when in 'system' mode
     useEffect(() => {
       if (theme !== "system") return;
       const mq = window.matchMedia("(prefers-color-scheme: dark)");
       const handler = () => apply("system");
       mq.addEventListener("change", handler);
       return () => mq.removeEventListener("change", handler);
     }, [theme, apply]);

     return { theme, setTheme };
   }
   ```

3. **Theme toggle in Settings.** Add it to `components/settings/SettingsPanel.tsx` as a three-way segmented control. Keep it out of the header — the header is busy enough.
   ```tsx
   const { theme, setTheme } = useTheme();
   // ...
   <div className="flex items-center gap-2">
     <span className="eyebrow">Appearance</span>
     <Segmented value={theme} onChange={setTheme}
       options={[
         { value: "light",  label: "Light"  },
         { value: "dark",   label: "Dark"   },
         { value: "system", label: "System" },
       ]}/>
   </div>
   ```
   Reuse the segmented control you built for the conformance-level selector in Step 5.

4. **Hunt down hardcoded colors.** Grep for `#`, `rgb(`, `bg-white`, `bg-gray-`, `text-gray-`, `text-black`, `border-gray-` — these are theme-blind. Replace each with the right token (`bg-surface`, `text-ink-1`, `border-rule`, etc.). The whole point of the token graph is that swapping themes should be invisible at the component level.

5. **Spot-check each surface in dark mode:**
   - Logo eyes should be accent-blue against a light body. The smile should be the new dark surface color (cuts out cleanly — that's why `Logo.tsx` uses `var(--surface)` for the smile).
   - Status bar's OK / warn / error dots should still pop — semantic colors are lifted in dark mode.
   - Form inputs need explicit `bg-surface text-ink-1`; native input rendering doesn't always follow CSS variables.
   - The `Tooltip` component has a dark background by default — in dark mode it needs to invert to `bg-ink-1 text-surface` so it doesn't blend with the surface.
   - PDF and `.docx` exports stay in light mode regardless of UI theme. Don't apply theme to the export pipeline.

6. **Add `<meta name="theme-color">`** for both modes in `app/layout.tsx` so the browser chrome (mobile address bar, Safari toolbar) matches:
   ```tsx
   export const metadata = {
     // ...existing fields
     themeColor: [
       { media: "(prefers-color-scheme: light)", color: "#FBFCFD" },
       { media: "(prefers-color-scheme: dark)",  color: "#0B1320" },
     ],
   };
   ```

**Stop here and have me review light/dark parity.** Toggle on every screen — SetupWizard, CriteriaReview (all three panes), CriterionDetail with each banner variant, SettingsPanel, the New Project modal. Any flash, hardcoded color, or low-contrast pair gets flagged before merging.

---

## Design tokens — full reference

### Color — light mode (`:root`)

| Token              | Hex       | Use                                                        |
|--------------------|-----------|------------------------------------------------------------|
| `--surface`        | `#FBFCFD` | Page background                                            |
| `--surface-2`      | `#F2F4F8` | Subtle elevation, hover, status bar                        |
| `--surface-3`      | `#E5E9F0` | Progress track, deeper neutrals                            |
| `--rule`           | `#D8DDE6` | Primary hairline borders                                   |
| `--rule-2`         | `#E8EBF1` | Dividers between list items                                |
| `--ink-1`          | `#0B1B33` | Titles, primary text, brand wordmark                       |
| `--ink-2`          | `#2F3D55` | Body copy                                                  |
| `--ink-3`          | `#5A6878` | Secondary text, helpers                                    |
| `--ink-4`          | `#8A95A4` | Tertiary, captions, disabled                               |
| `--ink-5`          | `#B5BEC9` | Placeholder, lightest readable                             |
| `--brand`          | `#0B1B33` | Wordmark (= ink-1)                                         |
| `--accent`         | `#1F6FEB` | Primary CTA, links, focus ring, active tab, progress fill  |
| `--accent-hover`   | `#1559C4` | CTA hover state                                            |
| `--accent-soft`    | `#E8EFFC` | Selection background, soft fills                           |
| `--accent-rule`    | `#C7D7F1` | Borders on accent-soft surfaces                            |
| `--issue`          | `#B23A1C` | Scanner findings, error text, danger-button text           |
| `--issue-bg`       | `#FBEAE2` | Issue banner background                                    |
| `--issue-rule`     | `#F0CDBC` | Issue banner border                                        |
| `--warn`           | `#8A6B14` | AI-inferred, caution                                       |
| `--warn-bg`        | `#F6EFD8` | Warn banner background                                     |
| `--warn-rule`      | `#E5D9B0` | Warn banner border                                         |
| `--ok`             | `#1F6B3A` | PM confirmed only — **not** save/CTA                       |
| `--ok-bg`          | `#E4EFE5` | OK banner background                                       |
| `--ok-rule`        | `#C9DDCB` | OK banner border                                           |

### Color — dark mode (`.dark` overrides)

Applied when `<html>` has `class="dark"`. The accent is **lifted** (`#5B9DFF`) because the default `#1F6FEB` is too dim against deep navy. Semantic foreground colors are likewise lifted; their backgrounds become desaturated deeps of the same hue.

| Token              | Dark hex  | Note                                                       |
|--------------------|-----------|------------------------------------------------------------|
| `--surface`        | `#0B1320` | Near-black with navy undertone (matches brand identity)    |
| `--surface-2`      | `#141D2F` | Elevated panels                                            |
| `--surface-3`      | `#1E2A40` | Deeper elevation, progress track                           |
| `--rule`           | `#283449` | Primary border                                             |
| `--rule-2`         | `#1C2638` | Item divider                                               |
| `--ink-1`          | `#F0F3F8` | Primary text — also the wordmark via `--brand`             |
| `--ink-2`          | `#C7CFDC` | Body                                                       |
| `--ink-3`          | `#8A95A8` | Secondary                                                  |
| `--ink-4`          | `#5A6578` | Tertiary, captions                                         |
| `--brand`          | `#F0F3F8` | Wordmark stays legible (= ink-1 in dark)                   |
| `--accent`         | `#5B9DFF` | Lifted blue — CTAs, links, focus ring                      |
| `--accent-hover`   | `#7DB1FF` | Hover                                                      |
| `--accent-soft`    | `#1A2842` | Selection background                                       |
| `--accent-rule`    | `#2D4773` | Borders on accent-soft surfaces                            |
| `--issue`          | `#FF8866` | Scanner findings, error text                               |
| `--issue-bg`       | `#3B1C12` | Deep terra background                                      |
| `--warn`           | `#DBC07F` | AI-inferred, caution                                       |
| `--warn-bg`        | `#2D2410` | Deep amber background                                      |
| `--ok`             | `#6DCB87` | PM confirmed                                               |
| `--ok-bg`          | `#0F2618` | Deep forest background                                     |

**Components don't reference the dark hex values directly.** Use the token name (`var(--ink-1)`, `bg-surface`, `text-ok`, etc.) and the dark values resolve automatically when `class="dark"` is set on `<html>`.

### Type scale

| Class           | Size    | Line   | Letter-spacing | Use                          |
|-----------------|---------|--------|----------------|------------------------------|
| `text-display`  | 40px    | 1.10   | -0.020em       | Hero only                    |
| `text-title`    | 28px    | 1.20   | -0.015em       | Section & modal titles       |
| `text-heading`  | 20px    | 1.30   | -0.005em       | Criterion titles             |
| `text-body`     | 15px    | 1.60   | 0              | Default body                 |
| `text-small`    | 13px    | 1.55   | 0              | Helpers, secondary labels    |
| `text-caption`  | 11.5px  | 1.40   | 0              | Badges, chips, captions      |
| `eyebrow`       | 11px    | —      | 0.18em + UC    | Section rails, group labels  |

**Mono is reserved for identifiers and eyebrows.** Never inside running prose.

### Radius & spacing

- Radius: `4px` (chips), `6px` (buttons, inputs), `8px` (banners, cards), `12px` (large panels), `9999px` (badges, progress).
- Spacing scale: commit to `4 · 8 · 12 · 16 · 24 · 40 · 64`.

### One rule about blue

The accent appears **only** in these places, app-wide:
1. Primary CTA buttons
2. Progress bar fill
3. Active tab underline
4. Focus ring
5. Active selection background (as `accent-soft`)
6. Links and link-style ghost buttons
7. The interview badge (`<Badge variant="accent">`)

If something else wants to be blue, it should probably be ink-1 instead.

---

## State management

No changes. The component split (`page.tsx` → `SetupWizard` or `CriteriaReview` + `SettingsPanel`) stays. State stays where it is.

---

## Interactions & behavior

No changes. Preserve:
- Auto-scan on project creation
- Optimistic "Confirm & next" with background save
- `Space` keyboard shortcut for "Confirm & next" when a review queue is active
- Tooltip behavior (the `Tooltip` component stays)
- The `__edit_mode_*` postMessage protocol is not in scope here

---

## Accessibility notes

The current header text at `#39FF14` / 30–50% alpha on `#0b1a0d` fails WCAG AA contrast. After Step 5 this is resolved entirely.

Additional defenses to add while you're in there:
- Promote any `text-[10px]` or `text-[11px]` to **11.5px minimum**. Grep: `text-\[1[01]px\]`.
- Add a visible focus ring everywhere — `focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2` is fine as a default.
- The conformance level `<select>` in `CriterionDetail.tsx` should be replaced with the segmented control shown in the spec — easier to scan and avoids the native select on macOS truncating long labels.

---

## Files to touch — quick checklist

| Path                                            | Step  | Change                                                |
|-------------------------------------------------|-------|-------------------------------------------------------|
| `app/globals.css`                               | 1     | Replace `:root` with `code/tokens.css` (includes `.dark`) |
| `app/layout.tsx`                                | 1, 7  | Plex fonts + anti-FOUC boot script + theme-color meta  |
| `tailwind.config.ts`                            | 1     | Merge `code/tailwind.config.snippet.ts`               |
| `components/Logo.tsx`                           | 2     | New file from `code/Logo.tsx` (theme-aware via tokens)|
| `components/useTheme.ts`                        | 7     | New — `useTheme()` hook with localStorage + OS sync   |
| `public/favicon.svg`                            | 2     | New file (extract SVG body from `Logo.tsx`)           |
| `public/a11ybot-logo.png`                       | 2     | Delete                                                |
| `components/ui/Button.tsx`                      | 3     | New                                                   |
| `components/ui/Chip.tsx`                        | 4     | New                                                   |
| `components/ui/Badge.tsx`                       | 4     | New                                                   |
| `components/ui/Banner.tsx`                      | 4     | New                                                   |
| `components/review/types.ts`                    | 4     | Trim `LEVEL_COLORS`, `getEvidenceSignal`              |
| `components/review/CriteriaReview.tsx`          | 3,4,5 | Header + sidebar + modal repaint, new components      |
| `components/review/CriterionDetail.tsx`         | 3,4   | Banners, buttons, segmented level control             |
| `components/review/StatusBar.tsx`               | 5     | Repaint to quiet inline strip                         |
| `components/review/FindingActions.tsx`          | 3     | Replace inline buttons with `<Button>`                |
| `components/review/Tooltip.tsx`                 | —     | No change (only verify dark-bg tooltip on light surface — may need a tone-down) |
| `components/setup/SetupWizard.tsx`              | 2,6   | Repaint left rail, swap buttons, update step dots     |
| `components/settings/SettingsPanel.tsx`         | 3, 7  | Buttons; add Appearance theme toggle (Light/Dark/System) |

---

## Don't touch

- API routes under `app/api/`
- The criteria store, scanners, AI client (`src/criteria`, `src/scanners`, `src/ai`)
- `src/state/project.ts`
- `src/types.ts` (the data model)
- The regression test suite

This is a UI refactor — the data and behavior stay exactly as-is.
