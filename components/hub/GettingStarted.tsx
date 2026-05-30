"use client";

import { Button } from "@/components/ui/Button";
import { TopBanner } from "@/components/TopBanner";

const GITHUB_ISSUES_URL = "https://github.com/richsharples/a11ybot/issues";

/** Getting Started guide — full-screen overlay reachable from the nav drawer. */
export function GettingStarted({ onClose }: { onClose: () => void }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <TopBanner />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-8 py-10 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-ink-1">Getting Started</h2>
            <Button variant="ghost" onClick={onClose} className="text-ink-3 hover:text-ink-1">
              <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Button>
          </div>

          <div className="space-y-5">
            <Step n={1} title="Create a project">
              Click <strong>New Project</strong> and fill in your product name, version, contact details, and choose
              which component types your product includes (web, desktop, docs, etc.). This determines which
              accessibility criteria apply.
            </Step>
            <Step n={2} title="Choose an input mode">
              <strong>Interview only</strong> — answer plain-language questions about each criterion manually.{" "}
              <strong>Source scan</strong> — point at a local code repo; A11yBot runs ESLint + jsx-a11y to find
              issues automatically. <strong>Runtime scan</strong> — point at a live URL; Lighthouse audits the page.{" "}
              <strong>Hybrid</strong> combines all three for the best coverage.
            </Step>
            <Step n={3} title="Set up AI drafting">
              Connect an <strong>OpenRouter</strong> API key (recommended) or a local <strong>Ollama</strong> model.
              A11yBot uses the AI to draft conformance language from your evidence. You can review and edit every
              draft before export.
            </Step>
            <Step n={4} title="Review criteria">
              Work through the criteria list. Each row shows the AI-drafted level (Supports, Partially Supports,
              Does Not Support, N/A) and remark. Confirm or edit each one — confirmed criteria are marked in green.
            </Step>
            <Step n={5} title="Export the VPAT">
              Click <strong>Export</strong> to generate a{" "}
              <code className="font-mono text-xs bg-surface-3 px-1 rounded">.docx</code> file formatted to the
              VPAT 2.5 template. Unconfirmed criteria are included as "Not Evaluated" so you can always export a
              draft mid-way through.
            </Step>
          </div>

          <p className="text-caption text-ink-4 pt-4 border-t border-rule">
            Questions or issues?{" "}
            <a href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              Open a GitHub issue →
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="w-6 h-6 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </div>
      <div>
        <div className="font-medium text-ink-1 text-small mb-0.5">{title}</div>
        <p className="text-caption text-ink-3 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}
