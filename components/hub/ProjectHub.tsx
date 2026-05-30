"use client";

import { useState, useEffect } from "react";
import { TopBanner } from "@/components/TopBanner";
import type { ProjectIndexEntry } from "@/src/state/project-store";

interface Props {
  onOpenMenu: () => void;
  onOpenSettings: () => void;
}

interface CriteriaSource {
  name: string;
  abbr?: string;
  url: string;
  editions: string[];
}
interface CriteriaStatus {
  manifest: { criteriaVersion: string; releasedAt: string; notes: string; sources: CriteriaSource[] };
}

function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

/**
 * Home splash — a read-only landing showing supported accessibility standards
 * and a summary of the user's projects. All navigation happens through the
 * hamburger menu (NavDrawer); this screen is purely informational.
 */
export function ProjectHub({ onOpenMenu, onOpenSettings }: Props) {
  const [criteriaStatus, setCriteriaStatus] = useState<CriteriaStatus | null>(null);
  const [projects, setProjects] = useState<ProjectIndexEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/criteria-status").then((r) => r.ok ? r.json() : null),
      fetch("/api/projects").then((r) => r.ok ? r.json() : []),
    ]).then(([criteria, list]) => {
      if (criteria) setCriteriaStatus(criteria);
      setProjects(list);
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  const inProgress = projects.filter((p) => p.progressPct > 0 && p.progressPct < 100).length;
  const recent = [...projects].sort((a, b) => +new Date(b.lastModified) - +new Date(a.lastModified)).slice(0, 4);

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <TopBanner onOpenMenu={onOpenMenu} onOpenSettings={onOpenSettings} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-8 py-14">
          {/* Hero */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-semibold text-ink-1 mb-3">A11yBot</h1>
            <p className="text-ink-3 max-w-xl mx-auto leading-relaxed">
              Generate VPAT&nbsp;2.5 Accessibility Conformance Reports with automated scanning and AI-assisted
              drafting — all running locally.
            </p>
            <p className="mt-4 text-caption text-ink-4">
              Open the{" "}
              <button type="button" onClick={onOpenMenu} className="inline-flex items-center gap-1 text-ink-3 hover:text-ink-1 underline underline-offset-2">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                menu
              </button>{" "}
              to start a new project or open an existing one.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Standards support */}
            <section className="rounded-xl border border-rule bg-surface-2 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-heading font-semibold text-ink-1">Accessibility Standards</h2>
                {criteriaStatus && (
                  <span className="text-[10px] font-mono text-ink-4 bg-surface-3 rounded px-1.5 py-0.5">
                    v{criteriaStatus.manifest.criteriaVersion}
                  </span>
                )}
              </div>
              {criteriaStatus ? (
                <>
                  <ul className="space-y-2.5">
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
                  <p className="mt-4 pt-3 border-t border-rule text-caption text-ink-4">
                    Criteria set released {criteriaStatus.manifest.releasedAt} · Section 508 &amp; International editions
                  </p>
                </>
              ) : (
                <p className="text-small text-ink-4">Loading standards…</p>
              )}
            </section>

            {/* Project information */}
            <section className="rounded-xl border border-rule bg-surface-2 p-6">
              <h2 className="text-heading font-semibold text-ink-1 mb-4">Your Projects</h2>

              <div className="flex gap-6 mb-4">
                <div>
                  <div className="text-2xl font-semibold text-ink-1">{projects.length}</div>
                  <div className="text-caption text-ink-4">saved</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-ink-1">{inProgress}</div>
                  <div className="text-caption text-ink-4">in progress</div>
                </div>
              </div>

              {loaded && projects.length === 0 ? (
                <p className="text-small text-ink-4">
                  No projects yet — open the menu to create your first VPAT.
                </p>
              ) : (
                <ul className="space-y-2 pt-3 border-t border-rule">
                  {recent.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-small font-medium text-ink-2 truncate">{p.productName}</span>
                        <span className="ml-1.5 text-[10px] font-mono text-ink-4">v{p.productVersion}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-16 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                          <div className="h-full bg-accent rounded-full" style={{ width: `${p.progressPct}%` }} />
                        </div>
                        <span className="text-[10px] text-ink-4 w-12 text-right">{relativeTime(p.lastModified)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
