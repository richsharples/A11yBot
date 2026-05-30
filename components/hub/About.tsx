"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { TopBanner } from "@/components/TopBanner";
import pkg from "../../package.json";

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
  onClose: () => void;
  onOpenMenu: () => void;
  onOpenSettings: () => void;
}

/** About page — full-screen overlay reachable from the nav drawer. */
export function About({ onClose, onOpenMenu, onOpenSettings }: Props) {
  const [criteriaStatus, setCriteriaStatus] = useState<CriteriaStatus | null>(null);

  useEffect(() => {
    fetch("/api/criteria-status")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setCriteriaStatus(d); })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <TopBanner onOpenMenu={onOpenMenu} onOpenSettings={onOpenSettings} onLogoClick={onClose} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-8 py-10 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-ink-1">About A11yBot</h2>
            <Button variant="ghost" onClick={onClose} className="text-ink-3 hover:text-ink-1">
              <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Button>
          </div>

          <p className="text-small text-ink-3 leading-relaxed">
            A11yBot is a local web app that helps product managers produce VPAT 2.5 Accessibility Conformance
            Reports. It combines automated scanning (ESLint, Lighthouse) with AI-assisted drafting to turn
            evidence into polished conformance language — all running locally, no data sent to external servers
            except your chosen AI provider.
          </p>
          <dl className="space-y-3 text-small">
            <div className="flex gap-3">
              <dt className="text-ink-3 w-28 shrink-0">Version</dt>
              <dd className="font-mono text-ink-2">{pkg.version}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-ink-3 w-28 shrink-0">VPAT Edition</dt>
              <dd className="text-ink-2">2.5 (Section 508 + International)</dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-ink-3 w-28 shrink-0">Author</dt>
              <dd>
                <a href="mailto:rich.sharples@gmail.com" className="text-accent hover:underline">Rich Sharples</a>
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
      </main>
    </div>
  );
}
