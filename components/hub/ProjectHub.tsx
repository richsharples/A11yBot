"use client";

import { Button } from "@/components/ui/Button";
import { TopBanner } from "@/components/TopBanner";

interface Props {
  onNewProject: () => void;
  onOpenMenu: () => void;
  onOpenSettings: () => void;
}

/**
 * Home landing — intentionally minimal. Primary navigation lives in the
 * hamburger menu (NavDrawer) in the top banner; this screen just welcomes the
 * user and offers the most common action (New Project) as a focal CTA.
 */
export function ProjectHub({ onNewProject, onOpenMenu, onOpenSettings }: Props) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <TopBanner onOpenMenu={onOpenMenu} onOpenSettings={onOpenSettings} />

      <main className="flex-1 flex flex-col items-center justify-center px-8 py-16">
        <div className="w-full max-w-lg text-center">
          <h1 className="text-2xl font-semibold text-ink-1 mb-2">Welcome to A11yBot</h1>
          <p className="text-small text-ink-3 mb-8">
            Generate VPAT 2.5 Accessibility Conformance Reports with AI-assisted drafting.
          </p>

          <Button variant="primary" onClick={onNewProject} className="mx-auto">
            <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </Button>

          <p className="mt-6 text-caption text-ink-4">
            Use the{" "}
            <button type="button" onClick={onOpenMenu} className="inline-flex items-center gap-1 text-ink-3 hover:text-ink-1 underline underline-offset-2">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
              menu
            </button>{" "}
            (top-left) to open an existing project, view the getting-started guide, or learn more.
          </p>
        </div>
      </main>
    </div>
  );
}
