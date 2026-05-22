"use client";

import { useState, useEffect, useCallback } from "react";
import type { Project, CriterionState, ConformanceLevel } from "@/src/types";
import { SetupWizard } from "@/components/setup";
import { CriteriaReview } from "@/components/review";
import { SettingsPanel } from "@/components/settings";

type AppView = "setup" | "review";

export default function Home() {
  const [view, setView] = useState<AppView>("setup");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    fetch("/api/project")
      .then((r) => r.ok ? r.json() : null)
      .then((p) => { if (p) { setProject(p); setView("review"); } })
      .catch(() => {});
  }, []);

  const handleProjectCreated = useCallback((p: Project) => {
    setProject(p);
    setView("review");
  }, []);

  const handleProjectUpdate = useCallback((updates: Partial<Project>) => {
    setProject((prev) => prev ? { ...prev, ...updates } : prev);
  }, []);

  const handleCriterionUpdate = useCallback((criterionId: string, cs: CriterionState) => {
    setProject((prev) => {
      if (!prev) return prev;
      return { ...prev, criteria: { ...prev.criteria, [criterionId]: cs } };
    });
  }, []);

  if (view === "setup") {
    return (
      <SetupWizard
        onCreated={handleProjectCreated}
        loading={loading}
        setLoading={setLoading}
        error={error}
        setError={setError}
      />
    );
  }

  if (!project) return null;

  return (
    <>
      {/* Settings gear — fixed top-right */}
      <button
        onClick={() => setSettingsOpen(true)}
        className="fixed top-4 right-4 z-30 p-2 rounded-lg bg-white border border-gray-200 shadow-sm text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
        aria-label="Open settings"
        title="Settings"
      >
        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
      </button>

      <CriteriaReview
        project={project}
        onCriterionUpdate={handleCriterionUpdate}
        onProjectUpdate={handleProjectUpdate}
        onNewProject={() => { setProject(null); setView("setup"); }}
      />

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
