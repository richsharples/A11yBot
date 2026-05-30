"use client";

import { useState, useEffect, useCallback } from "react";
import type { Project, CriterionState } from "@/src/types";
import { SetupWizard } from "@/components/setup";
import { CriteriaReview } from "@/components/review";
import { SettingsPanel, GlobalSettings } from "@/components/settings";
import { ProjectHub, GettingStarted, About } from "@/components/hub";
import { NavDrawer } from "@/components/NavDrawer";

type AppView = "hub" | "setup" | "review";
type Overlay = "gettingStarted" | "about" | null;

export default function Home() {
  const [view, setView] = useState<AppView>("hub");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);

  useEffect(() => {
    fetch("/api/projects/active")
      .then((r) => r.ok ? r.json() : null)
      .then((active) => {
        if (active) {
          setProject(active);
          setView("review");
        }
        // else stay on "hub" (home screen)
      })
      .catch(() => {});
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

  const openMenu = useCallback(() => setDrawerOpen(true), []);
  const openGlobalSettings = useCallback(() => setSettingsOpen(true), []);

  return (
    <>
      {view === "hub" && (
        <ProjectHub
          onOpenMenu={openMenu}
          onOpenSettings={openGlobalSettings}
        />
      )}

      {view === "setup" && (
        <SetupWizard
          onCreated={handleProjectCreated}
          onCancel={handleGoToHub}
          onOpenMenu={openMenu}
          onOpenSettings={openGlobalSettings}
          loading={loading}
          setLoading={setLoading}
          error={error}
          setError={setError}
        />
      )}

      {view === "review" && project && (
        <>
          <CriteriaReview
            project={project}
            onCriterionUpdate={handleCriterionUpdate}
            onProjectUpdate={handleProjectUpdate}
            onNewProject={handleGoToHub}
            onGoToHub={() => setView("hub")}
            onOpenMenu={openMenu}
            onOpenSettings={openGlobalSettings}
            onOpenProjectSettings={() => setProjectSettingsOpen(true)}
          />
          <SettingsPanel
            open={projectSettingsOpen}
            onClose={() => setProjectSettingsOpen(false)}
            project={project}
            onProjectUpdate={handleProjectUpdate}
          />
        </>
      )}

      {/* Global navigation drawer — opened from any TopBanner hamburger */}
      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNewProject={handleNewProject}
        onProjectLoaded={handleProjectLoaded}
        onGettingStarted={() => setOverlay("gettingStarted")}
        onAbout={() => setOverlay("about")}
      />

      {/* Global settings — right slide-in drawer (manages its own overlay) */}
      {settingsOpen && <GlobalSettings onClose={() => setSettingsOpen(false)} />}

      {/* Full-screen content overlays */}
      {overlay === "gettingStarted" && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-surface">
          <GettingStarted onClose={() => setOverlay(null)} onOpenMenu={openMenu} onOpenSettings={openGlobalSettings} />
        </div>
      )}
      {overlay === "about" && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-surface">
          <About onClose={() => setOverlay(null)} onOpenMenu={openMenu} onOpenSettings={openGlobalSettings} />
        </div>
      )}
    </>
  );
}
