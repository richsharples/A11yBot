"use client";

import { useState, useEffect } from "react";
import { LogoLockup } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import type { ProjectIndexEntry } from "@/src/state/project-store";
import type { Project } from "@/src/types";

interface Props {
  onNewProject: () => void;
  onProjectLoaded: (project: Project) => void;
}

function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function ProjectHub({ onNewProject, onProjectLoaded }: Props) {
  const [projects, setProjects] = useState<ProjectIndexEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ entry: ProjectIndexEntry } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/projects").then((r) => r.ok ? r.json() : []),
      fetch("/api/projects/active").then((r) => r.ok ? r.json() : null),
    ]).then(([list, active]) => {
      setProjects(list);
      setActiveId(active?.id ?? null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const loadProject = async (entry: ProjectIndexEntry) => {
    setLoadingId(entry.id);
    try {
      const res = await fetch(`/api/projects/${entry.id}`);
      if (!res.ok) throw new Error("Failed to load project");
      const project = await res.json() as Project;
      onProjectLoaded(project);
    } catch {
      setLoadingId(null);
    }
  };

  const handleSelect = (entry: ProjectIndexEntry) => {
    if (entry.id === activeId) {
      // Already active — just navigate to review
      fetch("/api/projects/active").then((r) => r.ok ? r.json() : null).then((p) => {
        if (p) onProjectLoaded(p);
      });
      return;
    }
    if (activeId) {
      setConfirm({ entry });
    } else {
      loadProject(entry);
    }
  };

  const handleNewProject = () => {
    if (activeId) {
      setConfirm({ entry: null as unknown as ProjectIndexEntry });
    } else {
      onNewProject();
    }
  };

  const confirmSwitch = async () => {
    if (!confirm) return;
    await fetch("/api/projects/active", { method: "DELETE" });
    setActiveId(null);
    setConfirm(null);
    if (!confirm.entry) {
      onNewProject();
    } else {
      loadProject(confirm.entry);
    }
  };

  const activeEntry = projects.find((p) => p.id === activeId);

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="border-b border-rule px-8 py-4 flex items-center justify-between">
        <LogoLockup size={36} />
        <Button variant="primary" onClick={handleNewProject}>
          + New project
        </Button>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-8 py-10">
        <h1 className="text-2xl font-semibold text-ink-1 mb-1">Projects</h1>
        <p className="text-small text-ink-3 mb-8">Select a project to continue, or create a new one.</p>

        {loading ? (
          <div className="text-small text-ink-4">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-ink-3 mb-4">No projects yet.</p>
            <Button variant="primary" onClick={onNewProject}>Create your first project</Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {projects.map((entry) => {
              const isActive = entry.id === activeId;
              const isLoading = loadingId === entry.id;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(entry)}
                    disabled={!!loadingId}
                    className={`w-full text-left rounded-xl border-2 px-5 py-4 transition-colors ${
                      isActive
                        ? "border-accent bg-accent-soft"
                        : "border-rule hover:border-accent-rule bg-surface"
                    } disabled:opacity-60`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-ink-1 truncate">{entry.productName}</span>
                          <span className="text-caption text-ink-3 font-mono shrink-0">v{entry.productVersion}</span>
                          {isActive && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent text-white shrink-0">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-caption text-ink-4 mt-0.5">
                          Last modified {relativeTime(entry.lastModified)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-small font-medium text-ink-2">{entry.progressPct}%</span>
                        <p className="text-[10px] text-ink-4">confirmed</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${entry.progressPct}%` }}
                      />
                    </div>

                    {isLoading && (
                      <p className="mt-2 text-caption text-accent">Loading…</p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* Switch confirmation modal */}
      {confirm && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setConfirm(null)} aria-hidden="true" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-surface rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
              <h2 className="font-semibold text-ink-1">
                {activeEntry ? `"${activeEntry.productName}" is saved.` : "Current project is saved."}
              </h2>
              <p className="text-small text-ink-3">
                {confirm.entry
                  ? `Switch to "${confirm.entry.productName} v${confirm.entry.productVersion}"?`
                  : "Start a new project?"}
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
                <Button variant="primary" onClick={confirmSwitch}>
                  {confirm.entry ? "Switch" : "New project"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
