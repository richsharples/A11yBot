"use client";

import { useState, useEffect, useCallback } from "react";
import { LogoLockup } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/components/useTheme";
import { DEFAULT_OPENROUTER_MODEL } from "@/src/ai/models";
import type { OpenRouterModelInfo } from "@/app/api/ai/models/route";
import type { ProjectIndexEntry } from "@/src/state/project-store";
import type { Project } from "@/src/types";

const APP_VERSION = "0.1.0-beta.8";
const GITHUB_ISSUES_URL = "https://github.com/richsharples/a11ybot/issues";

interface CriteriaSource {
  name: string;
  abbr?: string;
  url: string;
  editions: string[];
}
interface CriteriaStatus {
  manifest: { criteriaVersion: string; releasedAt: string; notes: string; sources: CriteriaSource[] };
}

interface Props {
  onNewProject: () => void;
  onProjectLoaded: (project: Project) => void;
}

type AiProvider = "openrouter" | "ollama" | "none";
interface OllamaStatus { available: boolean; models: string[] }
interface TestResult { status: "idle" | "testing" | "ok" | "error"; message?: string }

function groupByProvider(models: OpenRouterModelInfo[]): [string, OpenRouterModelInfo[]][] {
  const groups = new Map<string, OpenRouterModelInfo[]>();
  for (const m of models) {
    const provider = m.id.split("/")[0];
    const group = groups.get(provider) ?? [];
    group.push(m);
    groups.set(provider, group);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

type HubView = "home" | "open" | "guide" | "about" | "settings";

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
  const [view, setView] = useState<HubView>("home");
  const [confirm, setConfirm] = useState<{ entry: ProjectIndexEntry } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ entry: ProjectIndexEntry } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [criteriaStatus, setCriteriaStatus] = useState<CriteriaStatus | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/projects").then((r) => r.ok ? r.json() : []),
      fetch("/api/projects/active").then((r) => r.ok ? r.json() : null),
      fetch("/api/criteria-status").then((r) => r.ok ? r.json() : null),
    ]).then(([list, active, criteria]) => {
      setProjects(list);
      setActiveId(active?.id ?? null);
      if (criteria) setCriteriaStatus(criteria);
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

          {/* ── Home: 2×2 grid ── */}
          {view === "home" && (
            <>
              <div className="text-center mb-10">
                <h1 className="text-2xl font-semibold text-ink-1 mb-2">Welcome to A11yBot</h1>
                <p className="text-small text-ink-3">
                  Generate VPAT 2.5 Accessibility Conformance Reports with AI-assisted drafting.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
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

                <HomeCard
                  icon={
                    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                    </svg>
                  }
                  title="Open Existing"
                  description={hasProjects ? `${projects.length} saved project${projects.length !== 1 ? "s" : ""}` : "No saved projects yet"}
                  onClick={() => hasProjects && setView("open")}
                  disabled={!hasProjects}
                />

                <HomeCard
                  icon={
                    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  }
                  title="Getting Started"
                  description="Learn how to create and export a VPAT report."
                  onClick={() => setView("guide")}
                />

                <HomeCard
                  icon={
                    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  title="About"
                  description="Version info, credits, and support links."
                  onClick={() => setView("about")}
                />
              </div>

              {/* Settings — full-width below the 2×2 */}
              <HomeCard
                icon={
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
                title="Settings"
                description="AI provider, contact details, and appearance."
                onClick={() => setView("settings")}
                wide
              />
            </>
          )}

          {/* ── Open Existing ── */}
          {view === "open" && (
            <div className="space-y-6">
              <BackButton onClick={() => setView("home")} />
              <h2 className="text-2xl font-semibold text-ink-1">Saved Projects</h2>
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

          {/* ── Getting Started ── */}
          {view === "guide" && (
            <div className="space-y-6">
              <BackButton onClick={() => setView("home")} />
              <h2 className="text-2xl font-semibold text-ink-1">Getting Started</h2>

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
          )}

          {/* ── About ── */}
          {view === "about" && (
            <div className="space-y-6">
              <BackButton onClick={() => setView("home")} />
              <h2 className="text-2xl font-semibold text-ink-1">About A11yBot</h2>
              <p className="text-small text-ink-3 leading-relaxed">
                A11yBot is a local web app that helps product managers produce VPAT 2.5 Accessibility Conformance
                Reports. It combines automated scanning (ESLint, Lighthouse) with AI-assisted drafting to turn
                evidence into polished conformance language — all running locally, no data sent to external servers
                except your chosen AI provider.
              </p>
              <dl className="space-y-3 text-small">
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
                    <a href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      GitHub Issues
                    </a>
                  </dd>
                </div>
              </dl>

              {/* Compliance standards */}
              <div className="pt-4 border-t border-rule space-y-3">
                <p className="text-small font-medium text-ink-2">Supported Compliance Standards</p>
                {criteriaStatus ? (
                  <>
                    <p className="text-caption text-ink-4 font-mono">
                      Criteria set v{criteriaStatus.manifest.criteriaVersion} · {criteriaStatus.manifest.releasedAt}
                    </p>
                    <ul className="space-y-2">
                      {criteriaStatus.manifest.sources.map((s) => (
                        <li key={s.url} className="flex items-start gap-2">
                          <span className="mt-0.5 shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-3 text-ink-3 border border-rule">
                            {s.abbr ?? s.name.split(" ")[0]}
                          </span>
                          <a href={s.url} target="_blank" rel="noopener noreferrer"
                            className="text-small text-ink-2 hover:text-accent underline underline-offset-2 decoration-rule hover:decoration-accent transition-colors leading-snug">
                            {s.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                    {criteriaStatus.manifest.notes && (
                      <p className="text-caption text-warn bg-warn-bg border border-warn-rule rounded-md px-3 py-2">
                        {criteriaStatus.manifest.notes}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-small text-ink-4">Loading…</p>
                )}
              </div>

              <p className="text-caption text-ink-4 pt-4 border-t border-rule">
                &copy; {new Date().getFullYear()} Rich Sharples. All rights reserved.
              </p>
            </div>
          )}

          {/* ── Settings ── */}
          {view === "settings" && (
            <GlobalSettingsView onBack={() => setView("home")} />
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

function GlobalSettingsView({ onBack }: { onBack: () => void }) {
  const { theme, setTheme } = useTheme();

  // Contact
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactSaved, setContactSaved] = useState(false);

  // AI
  const [aiProvider, setAiProvider] = useState<AiProvider>("openrouter");
  const [aiKey, setAiKey] = useState("");
  const [aiModel, setAiModel] = useState(DEFAULT_OPENROUTER_MODEL);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [openrouterModels, setOpenrouterModels] = useState<OpenRouterModelInfo[]>([]);
  const [modelsSource, setModelsSource] = useState<"live" | "fallback">("fallback");
  const [testResult, setTestResult] = useState<TestResult>({ status: "idle" });
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);

  const fetchModels = useCallback((key?: string) => {
    const url = key ? `/api/ai/models?key=${encodeURIComponent(key)}` : "/api/ai/models";
    fetch(url).then((r) => r.ok ? r.json() : null).then((d) => {
      if (!d) return;
      setOpenrouterModels(d.models);
      setModelsSource(d.source);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/user-config").then((r) => r.ok ? r.json() : null),
      fetch("/api/ai/provider").then((r) => r.ok ? r.json() : null),
    ]).then(([cfg, providerData]) => {
      if (cfg?.contact) {
        setContactName(cfg.contact.name ?? "");
        setContactEmail(cfg.contact.email ?? "");
      }
      if (providerData) {
        setOllamaStatus(providerData.ollama);
        const p = providerData.current.provider !== "none"
          ? providerData.current.provider
          : cfg?.aiDefaults?.provider ?? "openrouter";
        const m = providerData.current.model || cfg?.aiDefaults?.model || DEFAULT_OPENROUTER_MODEL;
        setAiProvider(p);
        setAiModel(m);
      }
    }).catch(() => {});
    fetchModels();
  }, [fetchModels]);

  const handleSaveContact = async () => {
    await fetch("/api/user-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact: { name: contactName, email: contactEmail } }),
    });
    setContactSaved(true);
  };

  const handleTestAi = async () => {
    setTestResult({ status: "testing" });
    try {
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: aiProvider, apiKey: aiKey || undefined, model: aiModel }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      setTestResult(data.success ? { status: "ok" } : { status: "error", message: data.error });
    } catch (err) {
      setTestResult({ status: "error", message: String(err) });
    }
  };

  const handleSaveAi = async () => {
    setAiSaving(true);
    try {
      await fetch("/api/ai/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: aiProvider, apiKey: aiKey || undefined, model: aiModel }),
      });
      await fetch("/api/user-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiDefaults: { provider: aiProvider, model: aiModel, apiKey: aiKey || undefined } }),
      });
      setAiSaved(true);
      setTimeout(() => setAiSaved(false), 2000);
    } finally {
      setAiSaving(false);
    }
  };

  const inputCls = "w-full rounded border border-rule px-3 py-2 text-small bg-surface text-ink-1 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent";

  return (
    <div className="space-y-8">
      <BackButton onClick={onBack} />
      <h2 className="text-2xl font-semibold text-ink-1">Settings</h2>

      {/* Contact */}
      <section className="space-y-4">
        <div>
          <h3 className="text-heading font-semibold text-ink-1">Contact Details</h3>
          <p className="text-caption text-ink-3 mt-0.5">Pre-filled on every new project's VPAT cover page.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-small font-medium text-ink-2">Name</label>
            <input className={inputCls} value={contactName}
              onChange={(e) => { setContactName(e.target.value); setContactSaved(false); }}
              placeholder="Jane Smith" />
          </div>
          <div className="space-y-1">
            <label className="block text-small font-medium text-ink-2">Email</label>
            <input className={inputCls} type="email" value={contactEmail}
              onChange={(e) => { setContactEmail(e.target.value); setContactSaved(false); }}
              placeholder="jane@example.com" />
          </div>
        </div>
        <Button variant="secondary" onClick={handleSaveContact} disabled={contactSaved}>
          {contactSaved ? "✓ Saved" : "Save contact"}
        </Button>
      </section>

      <hr className="border-rule" />

      {/* AI Provider */}
      <section className="space-y-4">
        <div>
          <h3 className="text-heading font-semibold text-ink-1">AI Provider</h3>
          <p className="text-caption text-ink-3 mt-0.5">Used to draft conformance language across all projects.</p>
        </div>

        <div className="space-y-2">
          {/* OpenRouter */}
          <SettingsProviderCard selected={aiProvider === "openrouter"}
            onClick={() => { setAiProvider("openrouter"); setAiModel((m) => openrouterModels.some((r) => r.id === m) ? m : DEFAULT_OPENROUTER_MODEL); setAiSaved(false); }}>
            <span className="text-small font-medium text-ink-1">OpenRouter</span>
            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-soft text-accent">Recommended</span>
          </SettingsProviderCard>

          {aiProvider === "openrouter" && (
            <div className="ml-6 space-y-3 pt-1">
              <div className="space-y-1">
                <label className="block text-caption font-medium text-ink-2">API Key</label>
                <div className="flex gap-2">
                  <input type="password" aria-label="OpenRouter API Key"
                    className={inputCls + " flex-1"}
                    value={aiKey}
                    onChange={(e) => { setAiKey(e.target.value); setAiSaved(false); }}
                    onBlur={(e) => { if (e.target.value.startsWith("sk-or-")) fetchModels(e.target.value); }}
                    placeholder="sk-or-v1-… (leave blank to keep existing)" />
                  <Button variant="secondary" type="button" onClick={handleTestAi}
                    disabled={!aiModel || testResult.status === "testing"}>
                    {testResult.status === "testing" ? "…" : "Test"}
                  </Button>
                </div>
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
                  className="text-caption text-accent hover:underline mt-1 inline-block">Get a key →</a>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-caption font-medium text-ink-2">Model</label>
                  {modelsSource === "fallback" && (
                    <span className="text-[10px] text-ink-4">default list — save a key to load your models</span>
                  )}
                </div>
                <select aria-label="AI Model" className={inputCls}
                  value={aiModel} onChange={(e) => { setAiModel(e.target.value); setAiSaved(false); }}>
                  {openrouterModels.length === 0 ? (
                    <option value={DEFAULT_OPENROUTER_MODEL}>{DEFAULT_OPENROUTER_MODEL}</option>
                  ) : groupByProvider(openrouterModels).map(([prov, models]) => (
                    <optgroup key={prov} label={prov}>
                      {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Ollama */}
          <SettingsProviderCard
            selected={aiProvider === "ollama"}
            disabled={ollamaStatus !== null && !ollamaStatus.available}
            onClick={() => { if (ollamaStatus?.available) { setAiProvider("ollama"); setAiModel(ollamaStatus.models[0] ?? ""); setAiSaved(false); } }}>
            <span className="text-small font-medium text-ink-1">Ollama</span>
            <span className="ml-2 text-caption text-ink-4">local · free</span>
            {ollamaStatus === null && <span className="ml-2 text-caption text-ink-4">Detecting…</span>}
            {ollamaStatus?.available && (
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-ok-bg text-ok">
                {ollamaStatus.models.length} model{ollamaStatus.models.length !== 1 ? "s" : ""}
              </span>
            )}
            {ollamaStatus && !ollamaStatus.available && <span className="ml-2 text-caption text-issue">Not detected</span>}
          </SettingsProviderCard>

          {aiProvider === "ollama" && ollamaStatus?.available && (
            <div className="ml-6 pt-1 space-y-2">
              <div className="space-y-1">
                <label className="block text-caption font-medium text-ink-2">Model</label>
                <select aria-label="Ollama Model" className={inputCls}
                  value={aiModel} onChange={(e) => { setAiModel(e.target.value); setAiSaved(false); }}>
                  {ollamaStatus.models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <p className="text-xs text-amber-600">⚠ Local models produce less reliable conformance language.</p>
            </div>
          )}

          {/* None */}
          <SettingsProviderCard selected={aiProvider === "none"}
            onClick={() => { setAiProvider("none"); setAiSaved(false); }}>
            <span className="text-small font-medium text-ink-1">None</span>
            <span className="ml-2 text-caption text-ink-4">interview-only mode</span>
          </SettingsProviderCard>
        </div>

        {testResult.status === "ok" && (
          <div className="rounded-md bg-ok-bg border border-ok-rule text-ok text-caption p-2">✓ Connection successful</div>
        )}
        {testResult.status === "error" && (
          <div className="rounded-md bg-issue-bg border border-issue-rule text-issue text-caption p-2">{testResult.message}</div>
        )}

        <Button variant="secondary" onClick={handleSaveAi} disabled={aiSaving || aiSaved}>
          {aiSaved ? "✓ Saved" : aiSaving ? "Saving…" : "Save AI settings"}
        </Button>
      </section>

      <hr className="border-rule" />

      {/* Appearance */}
      <section className="space-y-4">
        <div>
          <h3 className="text-heading font-semibold text-ink-1">Appearance</h3>
          <p className="text-caption text-ink-3 mt-0.5">Applies across all sessions on this machine.</p>
        </div>
        <div className="flex rounded-md border border-rule overflow-hidden">
          {(["light", "system", "dark"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTheme(t)}
              className={`flex-1 py-2 text-small capitalize transition-colors ${
                theme === t ? "bg-accent text-white font-medium" : "text-ink-3 hover:bg-surface-2"
              }`}>
              {t}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function SettingsProviderCard({ selected, disabled, onClick, children }: { selected: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`w-full text-left px-3 py-2.5 rounded-lg border-2 transition-colors flex items-center gap-2 ${
        selected ? "border-accent bg-accent-soft" :
        disabled ? "border-rule opacity-50 cursor-not-allowed" :
        "border-rule hover:border-accent-rule"
      }`}>
      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "border-blue-500" : "border-ink-4"}`}>
        {selected && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
      </div>
      <div className="flex items-center flex-wrap">{children}</div>
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-small text-ink-3 hover:text-ink-1 transition-colors"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Home
    </button>
  );
}

function HomeCard({
  icon, title, description, onClick, accent, disabled, wide,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  accent?: boolean;
  disabled?: boolean;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left p-6 rounded-xl border-2 transition-colors w-full ${wide ? "col-span-2" : ""} ${
        disabled
          ? "border-rule bg-surface-2 opacity-50 cursor-not-allowed"
          : accent
          ? "border-accent bg-accent-soft hover:bg-accent-soft/80"
          : "border-rule bg-surface-2 hover:border-accent-rule hover:bg-surface-3"
      }`}
    >
      <div className={`mb-3 ${accent ? "text-accent" : "text-ink-3"}`}>{icon}</div>
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
