"use client";

import { useState, useEffect } from "react";
import { LogoLockup } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import type { ProjectIndexEntry } from "@/src/state/project-store";
import type { Project } from "@/src/types";

const APP_VERSION = "0.1.0-beta.8";
const GITHUB_ISSUES_URL = "https://github.com/richsharples/a11ybot/issues";

interface Props {
  onNewProject: () => void;
  onProjectLoaded: (project: Project) => void;
}

type ActiveCard = "open" | "guide" | "about" | null;

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
  const [activeCard, setActiveCard] = useState<ActiveCard>(null);
  const [confirm, setConfirm] = useState<{ entry: ProjectIndexEntry } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ entry: ProjectIndexEntry } | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const toggleCard = (card: ActiveCard) =>
    setActiveCard((prev) => (prev === card ? null : card));

  const activeEntry = projects.find((p) => p.id === activeId);
  const hasProjects = projects.length > 0;

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="border-b border-rule px-8 py-5 flex items-center justify-between">
        <LogoLockup size={36} />
        <span className="px-1.5 py-0.5 rounded-sm bg-surface-3 text-ink-3 font-mono text-caption">
          v{APP_VERSION}
        </span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-8 py-16">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-10">
            <h1 className="text-2xl font-semibold text-ink-1 mb-2">Welcome to A11yBot</h1>
            <p className="text-small text-ink-3">
              Generate VPAT 2.5 Accessibility Conformance Reports with AI-assisted drafting.
            </p>
          </div>

          {/* 2×2 card grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* New Project */}
            <HomeCard
              icon={
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              }
              title="New Project"
              description="Start a new VPAT assessment for a product."
              onClick={handleNewProject}
              accent
            />

            {/* Open Existing */}
            <HomeCard
              icon={
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
              }
              title="Open Existing"
              description={hasProjects ? `${projects.length} saved project${projects.length !== 1 ? "s" : ""}` : "No saved projects yet"}
              onClick={() => hasProjects && toggleCard("open")}
              active={activeCard === "open"}
              disabled={!hasProjects}
            />

            {/* Getting Started */}
            <HomeCard
              icon={
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              }
              title="Getting Started"
              description="Learn how to create and export a VPAT report."
              onClick={() => toggleCard("guide")}
              active={activeCard === "guide"}
            />

            {/* About */}
            <HomeCard
              icon={
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title="About"
              description="Version info, credits, and support links."
              onClick={() => toggleCard("about")}
              active={activeCard === "about"}
            />
          </div>

          {/* Expandable panels */}
          {activeCard === "open" && (
            <div className="mt-6 bg-surface-2 rounded-xl border border-rule p-6">
              <h2 className="text-heading font-semibold text-ink-1 mb-4">Saved Projects</h2>
              {loading ? (
                <p className="text-small text-ink-4">Loading…</p>
              ) : (
                <ul className="space-y-3">
                  {projects.map((entry) => {
                    const isActive = entry.id === activeId;
                    const isLoading = loadingId === entry.id;
                    return (
                      <li key={entry.id} className="flex items-center gap-2 group">
                        <button
                          type="button"
                          onClick={() => handleSelect(entry)}
                          disabled={!!loadingId}
                          className={`flex-1 min-w-0 text-left rounded-xl border-2 px-5 py-4 transition-colors ${
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
                        <button
                          type="button"
                          aria-label={`Delete ${entry.productName}`}
                          onClick={() => setConfirmDelete({ entry })}
                          className="shrink-0 p-2 rounded-lg text-ink-4 hover:text-issue hover:bg-issue-bg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {activeCard === "guide" && (
            <div className="mt-6 bg-surface-2 rounded-xl border border-rule p-6 space-y-5">
              <h2 className="text-heading font-semibold text-ink-1">Getting Started</h2>

              <div className="space-y-4">
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
                  Click <strong>Export</strong> to generate a <code className="font-mono text-xs bg-surface-3 px-1 rounded">.docx</code> file
                  formatted to the VPAT 2.5 template. Unconfirmed criteria are included as "Not Evaluated" so you can
                  always export a draft mid-way through.
                </Step>
              </div>

              <p className="text-caption text-ink-4 pt-2 border-t border-rule">
                Questions or issues?{" "}
                <a href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer"
                  className="text-accent hover:underline">
                  Open a GitHub issue →
                </a>
              </p>
            </div>
          )}

          {activeCard === "about" && (
            <div className="mt-6 bg-surface-2 rounded-xl border border-rule p-6 space-y-4">
              <h2 className="text-heading font-semibold text-ink-1">About A11yBot</h2>
              <p className="text-small text-ink-3 leading-relaxed">
                A11yBot is a local web app that helps product managers produce VPAT 2.5 Accessibility Conformance
                Reports. It combines automated scanning (ESLint, Lighthouse) with AI-assisted drafting to turn
                evidence into polished conformance language — all running locally, no data sent to external servers
                except your chosen AI provider.
              </p>
              <dl className="space-y-2 text-small">
                <div className="flex gap-3">
                  <dt className="text-ink-3 w-28 shrink-0">Version</dt>
                  <dd className="font-mono text-ink-2">{APP_VERSION}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="text-ink-3 w-28 shrink-0">VPAT Edition</dt>
                  <dd className="text-ink-2">2.5 (Section 508 + International)</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="text-ink-3 w-28 shrink-0">Author</dt>
                  <dd>
                    <a href="mailto:rich.sharples@gmail.com" className="text-accent hover:underline">
                      Rich Sharples
                    </a>
                  </dd>
                </div>
                <div className="flex gap-3">
                  <dt className="text-ink-3 w-28 shrink-0">Support</dt>
                  <dd>
                    <a href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer"
                      className="text-accent hover:underline">
                      GitHub Issues
                    </a>
                  </dd>
                </div>
              </dl>
              <p className="text-caption text-ink-4 pt-2 border-t border-rule">
                &copy; {new Date().getFullYear()} Rich Sharples. All rights reserved.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setConfirmDelete(null)} aria-hidden="true" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-surface rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
              <h2 className="font-semibold text-ink-1">Delete project?</h2>
              <p className="text-small text-ink-3">
                <span className="font-medium text-ink-1">"{confirmDelete.entry.productName} v{confirmDelete.entry.productVersion}"</span>{" "}
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
        </>
      )}

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

function HomeCard({
  icon, title, description, onClick, accent, active, disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  accent?: boolean;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left p-6 rounded-xl border-2 transition-colors w-full ${
        disabled
          ? "border-rule bg-surface-2 opacity-50 cursor-not-allowed"
          : active
          ? "border-accent bg-accent-soft"
          : accent
          ? "border-accent bg-accent-soft hover:bg-accent-soft/80"
          : "border-rule bg-surface-2 hover:border-accent-rule hover:bg-surface-3"
      }`}
    >
      <div className={`mb-3 ${accent || active ? "text-accent" : "text-ink-3"}`}>{icon}</div>
      <div className="font-semibold text-ink-1 mb-1">{title}</div>
      <p className="text-caption text-ink-3 leading-snug">{description}</p>
    </button>
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
