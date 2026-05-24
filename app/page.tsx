"use client";

import { useState, useEffect, useCallback } from "react";
import type { Project, CriterionState } from "@/src/types";
import { SetupWizard } from "@/components/setup";
import { CriteriaReview } from "@/components/review";
import { SettingsPanel } from "@/components/settings";
import { ProjectHub } from "@/components/hub";

type AppView = "hub" | "setup" | "review";

export default function Home() {
  const [view, setView] = useState<AppView>("setup");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/projects/active").then((r) => r.ok ? r.json() : null),
      fetch("/api/projects").then((r) => r.ok ? r.json() : []),
    ]).then(([active, list]) => {
      if (active) {
        setProject(active);
        setView("review");
      } else if (list.length > 0) {
        setView("hub");
      }
      // else stay on "setup" (wizard)
    }).catch(() => {});
  }, []);

  const handleProjectCreated = useCallback((p: Project) => {
    setProject(p);
    setView("review");
  }, []);

  const handleProjectLoaded = useCallback((p: Project) => {
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

  const handleNewProject = useCallback(() => {
    setProject(null);
    setView("setup");
  }, []);

  const handleGoToHub = useCallback(() => {
    setProject(null);
    setView("hub");
  }, []);

  if (view === "hub") {
    return (
      <ProjectHub
        onNewProject={handleNewProject}
        onProjectLoaded={handleProjectLoaded}
      />
    );
  }

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
      <CriteriaReview
        project={project}
        onCriterionUpdate={handleCriterionUpdate}
        onProjectUpdate={handleProjectUpdate}
        onNewProject={handleGoToHub}
        onGoToHub={() => setView("hub")}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} project={project} onProjectUpdate={handleProjectUpdate} />
    </>
  );
}
