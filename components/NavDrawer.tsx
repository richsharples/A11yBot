"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import type { ProjectIndexEntry } from "@/src/state/project-store";
import type { Project } from "@/src/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onNewProject: () => void;
  onProjectLoaded: (project: Project) => void;
  onGettingStarted: () => void;
  onAbout: () => void;
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

/**
 * Global navigation drawer — slides in from the left, GitHub-style, opened from
 * the TopBanner hamburger. Holds the primary nav: New Project, Open Existing
 * Project (expandable submenu of saved projects), Getting Started, About.
 * (Global Settings is intentionally excluded — it has its own button on the right.)
 */
export function NavDrawer({ open, onClose, onNewProject, onProjectLoaded, onGettingStarted, onAbout }: Props) {
  const [projects, setProjects] = useState<ProjectIndexEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ entry: ProjectIndexEntry | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ entry: ProjectIndexEntry } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch("/api/projects").then((r) => r.ok ? r.json() : []),
      fetch("/api/projects/active").then((r) => r.ok ? r.json() : null),
    ]).then(([list, active]) => {
      setProjects(list);
      setActiveId(active?.id ?? null);
    }).catch(() => {}).finally(() => setLoaded(true));
  }, [open]);

  const loadProject = async (entry: ProjectIndexEntry) => {
    setLoadingId(entry.id);
    try {
      const res = await fetch(`/api/projects/${entry.id}`);
      if (!res.ok) throw new Error("Failed to load project");
      const project = await res.json() as Project;
      onClose();
      onProjectLoaded(project);
    } catch {
      setLoadingId(null);
    }
  };

  const handleSelectProject = (entry: ProjectIndexEntry) => {
    if (entry.id === activeId) {
      fetch("/api/projects/active").then((r) => r.ok ? r.json() : null).then((p) => {
        if (p) { onClose(); onProjectLoaded(p); }
      });
      return;
    }
    if (activeId) setConfirm({ entry });
    else loadProject(entry);
  };

  const handleNewProject = () => {
    if (activeId) setConfirm({ entry: null });
    else { onClose(); onNewProject(); }
  };

  const confirmSwitch = async () => {
    if (!confirm) return;
    await fetch("/api/projects/active", { method: "DELETE" });
    setActiveId(null);
    const { entry } = confirm;
    setConfirm(null);
    if (!entry) { onClose(); onNewProject(); }
    else loadProject(entry);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await fetch(`/api/projects/${confirmDelete.entry.id}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== confirmDelete.entry.id));
      if (activeId === confirmDelete.entry.id) setActiveId(null);
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const activeEntry = projects.find((p) => p.id === activeId);
  const hasProjects = projects.length > 0;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} aria-hidden="true" />

      {/* Drawer */}
      <nav
        className="fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-surface shadow-xl z-50 flex flex-col"
        role="dialog"
        aria-label="Navigation menu"
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-rule">
          <span className="text-small font-semibold text-ink-2">Menu</span>
          <button type="button" onClick={onClose} aria-label="Close menu"
            className="p-1.5 rounded-md text-ink-3 hover:text-ink-1 hover:bg-surface-2 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* New Project */}
          <MenuItem
            onClick={handleNewProject}
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />}
            label="New Project"
          />

          {/* Open Existing Project — expandable submenu */}
          <MenuItem
            onClick={() => hasProjects && setOpenSubmenu((s) => !s)}
            disabled={!hasProjects}
            expanded={openSubmenu}
            chevron
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />}
            label="Open Existing Project"
            badge={hasProjects ? String(projects.length) : undefined}
          />

          {openSubmenu && hasProjects && (
            <ul className="pl-4 pr-2 pb-2 space-y-1">
              {projects.map((entry) => {
                const isActive = entry.id === activeId;
                const isLoading = loadingId === entry.id;
                return (
                  <li key={entry.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleSelectProject(entry)}
                      disabled={!!loadingId}
                      className={`flex-1 min-w-0 text-left rounded-lg px-3 py-2 transition-colors ${
                        isActive ? "bg-accent-soft" : "hover:bg-surface-2"
                      } disabled:opacity-60`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-small font-medium text-ink-1 truncate">{entry.productName}</span>
                        <span className="text-[10px] text-ink-4 font-mono shrink-0">v{entry.productVersion}</span>
                        {isActive && <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-accent text-white shrink-0">Active</span>}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full bg-surface-3 overflow-hidden">
                          <div className="h-full bg-accent rounded-full" style={{ width: `${entry.progressPct}%` }} />
                        </div>
                        <span className="text-[10px] text-ink-4 shrink-0">
                          {isLoading ? "Loading…" : `${entry.progressPct}% · ${relativeTime(entry.lastModified)}`}
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${entry.productName}`}
                      onClick={() => setConfirmDelete({ entry })}
                      className="shrink-0 p-1.5 rounded-md text-ink-4 hover:text-issue hover:bg-issue-bg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </li>
                );
              })}
              {loaded && !hasProjects && <li className="px-3 py-2 text-caption text-ink-4">No saved projects yet.</li>}
            </ul>
          )}

          <div className="my-2 border-t border-rule" />

          {/* Getting Started */}
          <MenuItem
            onClick={() => { onClose(); onGettingStarted(); }}
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />}
            label="Getting Started"
          />

          {/* About */}
          <MenuItem
            onClick={() => { onClose(); onAbout(); }}
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
            label="About"
          />
        </div>
      </nav>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => setConfirmDelete(null)} aria-hidden="true" />
          <div className="relative bg-surface rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <h2 className="font-semibold text-ink-1">Delete project?</h2>
            <p className="text-small text-ink-3">
              <span className="font-medium text-ink-1">&quot;{confirmDelete.entry.productName} v{confirmDelete.entry.productVersion}&quot;</span>{" "}
              will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Switch confirmation modal */}
      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => setConfirm(null)} aria-hidden="true" />
          <div className="relative bg-surface rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
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
      )}
    </>
  );
}

function MenuItem({
  onClick, icon, label, disabled, badge, chevron, expanded,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  badge?: string;
  chevron?: boolean;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-surface-2"
      }`}
    >
      <svg className="w-5 h-5 text-ink-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        {icon}
      </svg>
      <span className="flex-1 text-small font-medium text-ink-1">{label}</span>
      {badge && <span className="text-[10px] font-medium text-ink-3 bg-surface-3 rounded px-1.5 py-0.5">{badge}</span>}
      {chevron && (
        <svg className={`w-4 h-4 text-ink-4 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  );
}
