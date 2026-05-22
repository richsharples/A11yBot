"use client";

import { useState, useEffect, useCallback } from "react";
import type { Project, CriterionState, ConformanceLevel } from "@/src/types";
import { SetupWizard } from "@/components/setup";
import { CriteriaReview } from "@/components/review";

type AppView = "setup" | "review";

export default function Home() {
  const [view, setView] = useState<AppView>("setup");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If a project is already active (e.g. page refresh mid-session), skip splash
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
    <CriteriaReview
      project={project}
      onCriterionUpdate={handleCriterionUpdate}
      onProjectUpdate={handleProjectUpdate}
      onNewProject={() => { setProject(null); setView("setup"); }}
    />
  );
}
