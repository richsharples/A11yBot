"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import type { Project } from "@/src/types";

interface Props {
  open: boolean;
  onClose: () => void;
  project?: Project | null;
  onProjectUpdate?: (updates: Partial<Project>) => void;
}

export function SettingsPanel({ open, onClose, project, onProjectUpdate }: Props) {
  const [sourcePath, setSourcePath] = useState(project?.sourcePath ?? "");
  const [runtimeUrl, setRuntimeUrl] = useState(project?.runtimeUrl ?? "");
  const [pathsSaved, setPathsSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSourcePath(project?.sourcePath ?? "");
    setRuntimeUrl(project?.runtimeUrl ?? "");
    setPathsSaved(false);
  }, [open, project?.sourcePath, project?.runtimeUrl]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-surface shadow-xl z-50 flex flex-col" role="dialog" aria-label="Project settings">
        <div className="flex items-center justify-between p-5 border-b border-rule">
          <h2 className="text-heading font-semibold text-ink-1">Project Settings</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close settings">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {project ? (
            <section>
              <h3 className="text-small font-semibold text-ink-2 mb-1">Scan Paths</h3>
              <p className="text-caption text-ink-3 mb-3">
                Paths used when running source and runtime scans for{" "}
                <span className="font-medium text-ink-2">{project.productName}</span>.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-caption font-medium text-ink-2 mb-1">Source path</label>
                  <input
                    type="text"
                    className="w-full rounded border border-rule px-3 py-2 text-small bg-surface text-ink-1 font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="/Users/you/projects/myapp/src"
                    value={sourcePath}
                    onChange={(e) => { setSourcePath(e.target.value); setPathsSaved(false); }}
                  />
                  <p className="mt-1 text-caption text-ink-4">Absolute path scanned for accessibility violations</p>
                </div>
                <div>
                  <label className="block text-caption font-medium text-ink-2 mb-1">App URL</label>
                  <input
                    type="url"
                    className="w-full rounded border border-rule px-3 py-2 text-small bg-surface text-ink-1 font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="https://staging.example.com"
                    value={runtimeUrl}
                    onChange={(e) => { setRuntimeUrl(e.target.value); setPathsSaved(false); }}
                  />
                  <p className="mt-1 text-caption text-ink-4">URL for Lighthouse + axe runtime scan</p>
                </div>
                <Button
                  variant="secondary"
                  disabled={pathsSaved}
                  onClick={async () => {
                    const res = await fetch(`/api/projects/${project.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ sourcePath: sourcePath || null, runtimeUrl: runtimeUrl || null }),
                    });
                    if (res.ok) {
                      const updated = await res.json() as Project;
                      onProjectUpdate?.({ sourcePath: updated.sourcePath, runtimeUrl: updated.runtimeUrl });
                      setPathsSaved(true);
                    }
                  }}
                >
                  {pathsSaved ? "✓ Saved" : "Save paths"}
                </Button>
              </div>
            </section>
          ) : (
            <p className="text-small text-ink-3">No project is currently active.</p>
          )}
        </div>
      </div>
    </>
  );
}
