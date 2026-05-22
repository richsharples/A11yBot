"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Project, CriterionState, ConformanceLevel } from "@/src/types";

type StatusLevel = "info" | "warn" | "error" | "running";
type StatusEntry = { id: number; ts: string; level: StatusLevel; message: string };

interface Props {
  project: Project;
  onCriterionUpdate: (id: string, cs: CriterionState) => void;
  onProjectUpdate: (updates: Partial<Project>) => void;
  onNewProject: () => void;
}

type PushStatus = (level: StatusLevel, message: string) => number;
type ResolveStatus = (id: number, level: Exclude<StatusLevel, "running">, message: string) => void;

type EvidenceSignal = { scannerCount: number; interviewCount: number };

function getEvidenceSignal(evidence: import("@/src/types").Evidence[]): EvidenceSignal {
  return {
    scannerCount: evidence.filter((e) => e.source === "source-scan" || e.source === "runtime-scan").length,
    interviewCount: evidence.filter((e) => e.source === "interview").length,
  };
}

function Tooltip({ text, children, side = "top", className }: {
  text: string;
  children: React.ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  return (
    <span className={`relative group/tip inline-flex${className ? ` ${className}` : ""}`}>
      {children}
      <span className={[
        "absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none",
        "px-2 py-1 rounded bg-gray-900 text-white text-[11px] leading-snug whitespace-nowrap max-w-xs text-center",
        "opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 delay-500",
        side === "top" ? "bottom-full mb-2" : "top-full mt-2",
      ].join(" ")}>
        {text}
        <span className={[
          "absolute left-1/2 -translate-x-1/2 border-4 border-transparent",
          side === "top" ? "top-full border-t-gray-900" : "bottom-full border-b-gray-900",
        ].join(" ")} />
      </span>
    </span>
  );
}

function FindingActions({
  evidence,
  criterionRef,
  criterionText,
}: {
  evidence: import("@/src/types").Evidence;
  criterionRef: string;
  criterionText: string;
}) {
  const [flash, setFlash] = useState<"copy" | "github" | null>(null);
  const [showRepo, setShowRepo] = useState(false);
  const [repoInput, setRepoInput] = useState("");

  const plainText = [
    `Accessibility issue: ${criterionRef}`,
    evidence.rawId ? `Rule: ${evidence.rawId}` : null,
    `Detail: ${evidence.detail}`,
    evidence.ref ? `Location: ${evidence.ref}` : null,
  ].filter(Boolean).join("\n");

  const issueTitle = `Accessibility: ${criterionRef}${evidence.rawId ? ` — ${evidence.rawId}` : ""}`;
  const issueBody = [
    `## Accessibility Issue: ${criterionRef}`,
    "",
    `**Criterion:** ${criterionRef} — ${criterionText}`,
    evidence.rawId ? `**Rule:** \`${evidence.rawId}\`` : null,
    "",
    "### Finding",
    evidence.detail,
    "",
    evidence.ref ? `### Location\n\`\`\`\n${evidence.ref}\n\`\`\`` : null,
    "",
    "---",
    "_Found by VPAT Compliance Scanner_",
  ].filter((l) => l !== null).join("\n");

  const flashFor = (key: "copy" | "github") => {
    setFlash(key);
    setTimeout(() => setFlash(null), 2000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(plainText).then(() => flashFor("copy"));
  };

  const openIssue = (repoUrl: string) => {
    const base = repoUrl.replace(/\/$/, "").replace(/\.git$/, "");
    const url = `${base}/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;
    window.open(url, "_blank", "noopener");
    flashFor("github");
    setShowRepo(false);
  };

  const handleGitHub = () => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("vpat-github-repo") : null;
    if (saved) {
      openIssue(saved);
    } else {
      setRepoInput("");
      setShowRepo(true);
    }
  };

  const handleRepoSubmit = () => {
    const url = repoInput.trim();
    if (!url) return;
    localStorage.setItem("vpat-github-repo", url);
    openIssue(url);
  };

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Tooltip text="Copy this finding as plain text for pasting into an email">
          <button
            onClick={handleCopy}
            className="text-[10px] px-2 py-0.5 rounded border border-orange-300 text-orange-700 hover:bg-orange-100 transition-colors"
          >
            {flash === "copy" ? "Copied!" : "Copy"}
          </button>
        </Tooltip>
        <Tooltip text="Open a pre-filled GitHub issue with this finding's details">
          <button
            onClick={handleGitHub}
            className="text-[10px] px-2 py-0.5 rounded border border-orange-300 text-orange-700 hover:bg-orange-100 transition-colors"
          >
            {flash === "github" ? "Opened!" : "GitHub issue ↗"}
          </button>
        </Tooltip>
        {localStorage.getItem("vpat-github-repo") && (
          <Tooltip text="Change the saved GitHub repository URL">
            <button
              onClick={() => { localStorage.removeItem("vpat-github-repo"); setShowRepo(false); }}
              className="text-[10px] text-orange-400 hover:text-orange-600 transition-colors"
            >
              change repo
            </button>
          </Tooltip>
        )}
      </div>
      {showRepo && (
        <div className="flex items-center gap-1.5">
          <input
            aria-label="GitHub repository URL"
            className="flex-1 text-[10px] rounded border border-orange-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
            placeholder="https://github.com/org/repo"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleRepoSubmit(); if (e.key === "Escape") setShowRepo(false); }}
          />
          <button
            onClick={handleRepoSubmit}
            disabled={!repoInput.trim()}
            className="text-[10px] px-2 py-1 rounded bg-orange-700 text-white hover:bg-orange-800 disabled:opacity-50"
          >
            Open
          </button>
          <button onClick={() => setShowRepo(false)} className="text-[10px] text-orange-500 hover:text-orange-700">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

const LEVEL_LABELS: Record<ConformanceLevel, string> = {
  supports: "Supports",
  partial: "Partially Supports",
  doesNotSupport: "Does Not Support",
  notApplicable: "Not Applicable",
  notEvaluated: "Not Evaluated",
};

const LEVEL_COLORS: Record<ConformanceLevel, string> = {
  supports: "bg-green-100 text-green-800 border-green-200",
  partial: "bg-yellow-100 text-yellow-800 border-yellow-200",
  doesNotSupport: "bg-red-100 text-red-800 border-red-200",
  notApplicable: "bg-gray-100 text-gray-600 border-gray-200",
  notEvaluated: "bg-slate-100 text-slate-600 border-slate-200",
};

type CriteriaData = { chapters: { id: string; title: string; criteria: { id: string; ref: string; text: string; interviewQuestion?: string }[] }[] };

export function CriteriaReview({ project, onCriterionUpdate, onProjectUpdate, onNewProject }: Props) {
  const [criteriaData, setCriteriaData] = useState<CriteriaData | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [selectedCriterion, setSelectedCriterion] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [draftingAll, setDraftingAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [statusLog, setStatusLog] = useState<StatusEntry[]>([]);
  const [criteriaStatus, setCriteriaStatus] = useState<import("@/src/state/criteria-store").CriteriaStatus | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const statusIdRef = useRef(0);

  const pushStatus = useCallback<PushStatus>((level, message) => {
    const id = statusIdRef.current++;
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setStatusLog((prev) => [...prev.slice(-199), { id, ts, level, message }]);
    return id;
  }, []);

  const resolveStatus = useCallback<ResolveStatus>((id, level, message) => {
    setStatusLog((prev) => prev.map((e) => e.id === id ? { ...e, level, message } : e));
  }, []);

  // Fetch criteria structure and store status
  useEffect(() => {
    fetch(`/api/criteria?edition=${project.edition}`)
      .then((r) => r.json())
      .then(setCriteriaData)
      .catch(() => {});
    fetch("/api/criteria-status")
      .then((r) => r.json())
      .then(setCriteriaStatus)
      .catch(() => {});
  }, [project.edition]);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    const sid = pushStatus("running", "Checking for criteria updates…");
    try {
      const res = await fetch("/api/criteria-status", { method: "POST" });
      const data = await res.json();
      setCriteriaStatus(data);
      resolveStatus(sid, "info",
        data.updated
          ? `Criteria updated to v${data.newVersion} — restart the dev server to apply.`
          : `Criteria are up to date (v${data.manifest?.criteriaVersion}).`
      );
    } catch {
      resolveStatus(sid, "error", "Criteria update check failed.");
    } finally {
      setCheckingUpdate(false);
    }
  };

  const runSourceScan = useCallback(async () => {
    if (!project.sourcePath) return;
    setScanning(true);
    const sid = pushStatus("running", "Source scan running…");
    try {
      const res = await fetch("/api/scan/source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePath: project.sourcePath }),
      });
      const data = await res.json();
      resolveStatus(sid, "info", `Source scan done — ${data.evidenceAdded} evidence items across ${data.criteriaWithEvidence} criteria.`);
      const p = await fetch("/api/project").then((r) => r.json());
      onProjectUpdate({ criteria: p.criteria });
    } catch (err) {
      resolveStatus(sid, "error", `Source scan failed: ${err}`);
    } finally {
      setScanning(false);
    }
  }, [project.sourcePath, onProjectUpdate, pushStatus, resolveStatus]);

  const runRuntimeScan = useCallback(async () => {
    if (!project.runtimeUrl) return;
    setScanning(true);
    const sid = pushStatus("running", "AppScan running…");
    try {
      const res = await fetch("/api/scan/runtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: project.runtimeUrl }),
      });
      const data = await res.json();
      resolveStatus(sid, "info", `AppScan done — ${data.evidenceAdded} evidence items across ${data.pathsScanned} path(s).`);
      const p = await fetch("/api/project").then((r) => r.json());
      onProjectUpdate({ criteria: p.criteria });
    } catch (err) {
      resolveStatus(sid, "error", `AppScan failed: ${err}`);
    } finally {
      setScanning(false);
    }
  }, [project.runtimeUrl, onProjectUpdate, pushStatus, resolveStatus]);

  const draftAll = useCallback(async () => {
    setDraftingAll(true);
    const sid = pushStatus("running", "AI drafting all unevaluated criteria…");
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftAll: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "AI draft failed");
      }
      const data = await res.json();
      resolveStatus(sid, "info", `AI draft complete — ${data.updated} criteria drafted.`);
      const p = await fetch("/api/project").then((r) => r.json());
      onProjectUpdate({ criteria: p.criteria });
    } catch (err) {
      resolveStatus(sid, "error", `AI draft all failed: ${err}`);
    } finally {
      setDraftingAll(false);
    }
  }, [onProjectUpdate, pushStatus, resolveStatus]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    const sid = pushStatus("running", "Exporting .docx…");
    try {
      const res = await fetch("/api/export", { method: "POST" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("content-disposition")?.split('filename="')[1]?.replace('"', "") ?? "vpat.docx";
      a.click();
      URL.revokeObjectURL(url);
      resolveStatus(sid, "info", "Export complete — .docx downloaded.");
    } catch (err) {
      resolveStatus(sid, "error", `Export failed: ${err}`);
    } finally {
      setExporting(false);
    }
  }, [pushStatus, resolveStatus]);

  const totalCriteria = Object.keys(project.criteria).length;
  const evaluated = Object.values(project.criteria).filter((c) => c.level !== "notEvaluated").length;
  const confirmed = Object.values(project.criteria).filter((c) => c.confidence === "pm-confirmed").length;

  // Ordered list of criteria that need PM review (AI inferred, not yet confirmed)
  const reviewList = useMemo(() => {
    if (!criteriaData) return [];
    return criteriaData.chapters
      .flatMap((ch) => ch.criteria.map((c) => ({ chapterId: ch.id, criterionId: c.id })))
      .filter(({ criterionId }) => project.criteria[criterionId]?.confidence === "ai-inferred");
  }, [criteriaData, project.criteria]);

  const [reviewIdx, setReviewIdx] = useState<number | null>(null);

  // Keep reviewIdx in bounds when items are confirmed and drop off the list
  useEffect(() => {
    if (reviewIdx !== null && reviewList.length === 0) {
      setReviewIdx(null);
    } else if (reviewIdx !== null && reviewIdx >= reviewList.length) {
      setReviewIdx(reviewList.length - 1);
    }
  }, [reviewList.length, reviewIdx]);

  // Sync reviewIdx when user clicks a criterion in the sidebar
  useEffect(() => {
    if (!selectedCriterion) return;
    const idx = reviewList.findIndex((r) => r.criterionId === selectedCriterion);
    if (idx !== -1) setReviewIdx(idx);
  }, [selectedCriterion, reviewList]);

  const navigateReview = useCallback((dir: 1 | -1) => {
    if (reviewList.length === 0) return;
    const next = reviewIdx === null
      ? (dir === 1 ? 0 : reviewList.length - 1)
      : Math.max(0, Math.min(reviewList.length - 1, reviewIdx + dir));
    setReviewIdx(next);
    setSelectedChapter(reviewList[next].chapterId);
    setSelectedCriterion(reviewList[next].criterionId);
  }, [reviewList, reviewIdx]);

  if (!criteriaData) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading criteria…</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-blue-700 tracking-wide">Compliance Suite : VPAT</span>
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-600"><span className="font-medium text-gray-800">Product Name:</span> {project.productName} {project.productVersion}</span>
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-600"><span className="font-medium text-gray-800">VPAT Type:</span> {project.edition}</span>
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-600"><span className="font-medium text-gray-800">Date:</span> {new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
          </div>
          <div className="flex items-center gap-3">
            <ProgressBar evaluated={evaluated} total={totalCriteria} confirmed={confirmed} />
            <Tooltip text="Download the completed VPAT as a .docx file" side="bottom">
              <button onClick={handleExport} disabled={exporting} className="py-2 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {exporting ? "Exporting…" : "Export .docx"}
              </button>
            </Tooltip>
          </div>
        </div>
      </header>

      {/* Scan / AI action bar */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center gap-3 flex-wrap">
        {(project.mode === "source" || project.mode === "hybrid") && project.sourcePath && (
          <Tooltip text="Scan JSX/TSX source files for accessibility violations using ESLint + jsx-a11y" side="bottom">
            <button onClick={runSourceScan} disabled={scanning} className="py-1.5 px-3 rounded bg-white border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50">
              {scanning ? "Scanning…" : "Run source scan"}
            </button>
          </Tooltip>
        )}
        {(project.mode === "runtime" || project.mode === "hybrid") && project.runtimeUrl && (
          <Tooltip text="Run Lighthouse against the configured URL to detect runtime accessibility issues" side="bottom">
            <button onClick={runRuntimeScan} disabled={scanning} className="py-1.5 px-3 rounded bg-white border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50">
              {scanning ? "Scanning…" : "Run AppScan"}
            </button>
          </Tooltip>
        )}
        <Tooltip text="Send all unevaluated criteria to Claude for automated assessment in parallel" side="bottom">
          <button onClick={draftAll} disabled={draftingAll} className="py-1.5 px-3 rounded bg-white border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50">
            {draftingAll ? "Drafting…" : `AI draft all (${totalCriteria - evaluated} remaining)`}
          </button>
        </Tooltip>
        <Tooltip text="Discard this session and start a new VPAT project" side="bottom">
          <button onClick={onNewProject} className="py-1.5 px-3 rounded bg-white border border-gray-300 text-sm hover:bg-gray-50 text-gray-500">
            New project
          </button>
        </Tooltip>
        {criteriaStatus && (
          <Tooltip text="View compliance standard sources and criteria version" side="bottom">
            <button
              onClick={() => setShowSources((s) => !s)}
              className={`py-1.5 px-3 rounded border text-sm transition-colors ${showSources ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            >
              Sources · v{criteriaStatus.manifest.criteriaVersion}
            </button>
          </Tooltip>
        )}
        {reviewList.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
            <span className="font-medium">AI review</span>
            <span className="text-yellow-600">
              {reviewIdx !== null ? `${reviewIdx + 1} / ${reviewList.length}` : reviewList.length}
            </span>
            <Tooltip text="Previous AI-inferred criterion" side="bottom">
              <button
                onClick={() => navigateReview(-1)}
                disabled={reviewIdx === 0}
                className="px-1 hover:text-yellow-900 disabled:opacity-30 disabled:cursor-default"
                aria-label="Previous AI-inferred criterion"
              >←</button>
            </Tooltip>
            <Tooltip text="Next AI-inferred criterion" side="bottom">
              <button
                onClick={() => navigateReview(1)}
                disabled={reviewIdx === reviewList.length - 1}
                className="px-1 hover:text-yellow-900 disabled:opacity-30 disabled:cursor-default"
                aria-label="Next AI-inferred criterion"
              >→</button>
            </Tooltip>
          </div>
        )}
        {reviewList.length === 0 && confirmed > 0 && (
          <span className="ml-auto text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
            ✓ All AI drafts reviewed
          </span>
        )}
      </div>

      {/* Criteria sources panel */}
      {showSources && criteriaStatus && (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <span className="text-sm font-semibold text-gray-800">Compliance Standards</span>
              <span className="ml-2 text-xs text-gray-500">
                Criteria v{criteriaStatus.manifest.criteriaVersion} · Released {criteriaStatus.manifest.releasedAt}
                {criteriaStatus.lastChecked && ` · Checked ${new Date(criteriaStatus.lastChecked).toLocaleDateString()}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {criteriaStatus.manifest.checkUrl && (
                <Tooltip text="Check for updated criteria files now">
                  <button
                    onClick={handleCheckUpdate}
                    disabled={checkingUpdate}
                    className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {checkingUpdate ? "Checking…" : "Check for updates"}
                  </button>
                </Tooltip>
              )}
              <button onClick={() => setShowSources(false)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {criteriaStatus.manifest.sources
              .filter((s) => s.editions.includes(project.edition))
              .map((source) => (
                <a
                  key={source.abbr}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-gray-200 px-3 py-2.5 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-blue-700 group-hover:underline">{source.abbr}</span>
                    <span className="text-[10px] text-gray-400">↗</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 leading-snug">{source.description}</p>
                </a>
              ))}
          </div>
          {criteriaStatus.manifest.notes && (
            <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              ⚠ {criteriaStatus.manifest.notes}
            </p>
          )}
          <p className="mt-2 text-[11px] text-gray-400">
            Stored at: <code className="font-mono">{criteriaStatus.storeDir}</code>
          </p>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chapter sidebar */}
        <nav className="w-64 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
          {criteriaData.chapters.map((chapter) => {
            const chapterCriteria = chapter.criteria.map((c) => project.criteria[c.id]).filter(Boolean);
            const chapterEval = chapterCriteria.filter((c) => c.level !== "notEvaluated").length;

            // Count scanner evidence on unevaluated criteria only
            let sourceCount = 0;
            let appScanCount = 0;
            for (const cs of chapterCriteria) {
              if (cs.level !== "notEvaluated") continue;
              for (const e of cs.evidence) {
                if (e.source === "source-scan") sourceCount++;
                else if (e.source === "runtime-scan") appScanCount++;
              }
            }
            const totalScannerEvidence = sourceCount + appScanCount;

            return (
              <button
                key={chapter.id}
                onClick={() => { setSelectedChapter(chapter.id); setSelectedCriterion(null); }}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedChapter === chapter.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`}
              >
                <div className="text-sm font-medium text-gray-900 leading-tight">{chapter.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{chapterEval}/{chapter.criteria.length} evaluated</div>
                {totalScannerEvidence > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium leading-none">
                      ⚠ {totalScannerEvidence} issue{totalScannerEvidence !== 1 ? "s" : ""} pending
                    </span>
                    {sourceCount > 0 && (
                      <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 leading-none border border-orange-200">
                        {sourceCount} source
                      </span>
                    )}
                    {appScanCount > 0 && (
                      <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 leading-none border border-orange-200">
                        {appScanCount} app
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Criteria list + detail panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* Criteria list */}
          {selectedChapter && (
            <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
              {criteriaData.chapters.find((c) => c.id === selectedChapter)?.criteria.map((criterion) => {
                const cs = project.criteria[criterion.id];
                return (
                  <button
                    key={criterion.id}
                    aria-label={criterion.ref}
                    onClick={() => setSelectedCriterion(criterion.id)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedCriterion === criterion.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 shrink-0 text-xs px-1.5 py-0.5 rounded border font-medium ${cs ? LEVEL_COLORS[cs.level] : LEVEL_COLORS.notEvaluated}`}>
                        {cs ? LEVEL_LABELS[cs.level].split(" ")[0] : "—"}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-900 leading-tight">{criterion.ref}</div>
                        {cs?.confidence === "ai-inferred" && cs.level !== "notEvaluated" && (
                          <span className="text-[10px] text-yellow-600">AI inferred</span>
                        )}
                        {cs?.evidence && cs.evidence.length > 0 && (() => {
                          const sig = getEvidenceSignal(cs.evidence);
                          return (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {sig.scannerCount > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium leading-none">
                                  <span>⚠</span> {sig.scannerCount} issue{sig.scannerCount !== 1 ? "s" : ""}
                                </span>
                              )}
                              {sig.interviewCount > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium leading-none">
                                  <span>✎</span> interviewed
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Detail panel */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedCriterion ? (
              <CriterionDetail
                criterionId={selectedCriterion}
                criterionDef={criteriaData.chapters.flatMap((c) => c.criteria).find((c) => c.id === selectedCriterion)!}
                cs={project.criteria[selectedCriterion]}
                onUpdate={onCriterionUpdate}
                onStatus={pushStatus}
                onResolveStatus={resolveStatus}
              />
            ) : selectedChapter ? (
              <div className="text-gray-500 text-sm">Select a criterion from the list.</div>
            ) : (
              <div className="text-gray-500 text-sm">Select a chapter from the sidebar to begin.</div>
            )}
          </div>
        </div>
      </div>

      <StatusBar entries={statusLog} onClear={() => setStatusLog([])} />
    </div>
  );
}

function StatusBar({ entries, onClear }: { entries: StatusEntry[]; onClear: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, collapsed]);

  const latest = entries[entries.length - 1];

  const levelStyle: Record<StatusLevel, string> = {
    info:    "text-slate-300",
    warn:    "text-yellow-400",
    error:   "text-red-400",
    running: "text-blue-400",
  };
  const badgeStyle: Record<StatusLevel, string> = {
    info:    "bg-green-900 text-green-300",
    warn:    "bg-yellow-900 text-yellow-300",
    error:   "bg-red-900 text-red-300",
    running: "bg-blue-900 text-blue-300",
  };
  const badgeIcon: Record<StatusLevel, React.ReactNode> = {
    info:    "✓",
    warn:    "⚠",
    error:   "✕",
    running: <span className="inline-flex items-center gap-1"><span className="animate-spin inline-block">↻</span> running</span>,
  };

  return (
    <div className="sticky bottom-0 z-20 border-t border-slate-700 bg-slate-900 text-xs font-mono select-text">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-700">
        <Tooltip text={collapsed ? "Expand status panel" : "Collapse status panel"}>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label={collapsed ? "Expand status" : "Collapse status"}
          >
            <span className="text-slate-500">{collapsed ? "▲" : "▼"}</span>
            <span className="font-semibold tracking-wide uppercase text-slate-400">Status</span>
          </button>
        </Tooltip>
        {collapsed && latest && (
          <span className={`truncate max-w-xl ${levelStyle[latest.level]}`}>
            <span className="text-slate-500 mr-1">{latest.ts}</span>
            {latest.message}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {entries.length > 0 && (
            <span className="text-slate-500">{entries.length} entr{entries.length === 1 ? "y" : "ies"}</span>
          )}
          <Tooltip text="Clear all status messages">
            <button
              onClick={onClear}
              className="text-slate-500 hover:text-slate-300 transition-colors px-1"
            >
              Clear
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Log entries */}
      {!collapsed && (
        <div ref={scrollRef} className="h-32 overflow-y-auto px-3 py-1.5 space-y-0.5">
          {entries.length === 0 ? (
            <div className="text-slate-600 italic py-1">No activity yet.</div>
          ) : (
            entries.map((e) => (
              <div key={e.id} className={`flex gap-2 items-start leading-5 ${levelStyle[e.level]}`}>
                <span className="text-slate-600 shrink-0">{e.ts}</span>
                <span className={`shrink-0 px-1 rounded text-[10px] font-semibold ${badgeStyle[e.level]}`}>
                  {badgeIcon[e.level]}
                </span>
                <span className="break-all">{e.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ evaluated, total, confirmed }: { evaluated: number; total: number; confirmed: number }) {
  const pct = total ? Math.round((evaluated / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span>{evaluated}/{total} evaluated</span>
      {confirmed > 0 && <span className="text-green-600">({confirmed} confirmed)</span>}
    </div>
  );
}

function CriterionDetail({
  criterionId,
  criterionDef,
  cs,
  onUpdate,
  onStatus,
  onResolveStatus,
}: {
  criterionId: string;
  criterionDef: { id: string; ref: string; text: string; interviewQuestion?: string };
  cs: CriterionState;
  onUpdate: (id: string, cs: CriterionState) => void;
  onStatus: PushStatus;
  onResolveStatus: ResolveStatus;
}) {
  const [level, setLevel] = useState<ConformanceLevel>(cs?.level ?? "notEvaluated");
  const [remark, setRemark] = useState(cs?.remark ?? "");
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync when criterion changes
  useEffect(() => {
    setLevel(cs?.level ?? "notEvaluated");
    setRemark(cs?.remark ?? "");
    setAnswer("");
    setError(null);
  }, [criterionId, cs]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/criterion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criterionId, level, remark }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json() as CriterionState;
      onUpdate(criterionId, updated);
      onStatus("info", `${criterionDef.ref} saved.`);
    } catch (err) {
      setError(String(err));
      onStatus("error", `Save failed for ${criterionDef.ref}: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await fetch("/api/criterion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criterionId, answer }),
      });
      setDrafting(true);
      const sid = onStatus("running", `AI drafting ${criterionDef.ref}…`);
      const draftRes = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criterionId }),
      });
      if (draftRes.ok) {
        const updated = await draftRes.json() as CriterionState & { reasoning?: string };
        setLevel(updated.level);
        setRemark(updated.remark);
        onUpdate(criterionId, updated);
        onResolveStatus(sid, "info", `AI draft complete for ${criterionDef.ref}.`);
      } else {
        const body = await draftRes.json().catch(() => ({}));
        const msg = body.error ?? "AI draft failed";
        onResolveStatus(sid, "error", `${criterionDef.ref}: ${msg}`);
      }
      setAnswer("");
    } catch (err) {
      setError(String(err));
      onStatus("error", `${criterionDef.ref}: ${err}`);
    } finally {
      setSaving(false);
      setDrafting(false);
    }
  };

  const resetCriterion = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/criterion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criterionId, level: "notEvaluated", remark: "" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json() as CriterionState;
      setLevel("notEvaluated");
      setRemark("");
      onUpdate(criterionId, updated);
      onStatus("info", `${criterionDef.ref} reset to Not Evaluated.`);
    } catch (err) {
      setError(String(err));
      onStatus("error", `Reset failed for ${criterionDef.ref}: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const draftOnly = async () => {
    setDrafting(true);
    setError(null);
    const sid = onStatus("running", `AI drafting ${criterionDef.ref}…`);
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criterionId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "AI draft failed");
      }
      const updated = await res.json() as CriterionState;
      setLevel(updated.level);
      setRemark(updated.remark);
      onUpdate(criterionId, updated);
      onResolveStatus(sid, "info", `AI draft complete for ${criterionDef.ref}.`);
    } catch (err) {
      setError(String(err));
      onResolveStatus(sid, "error", `${criterionDef.ref}: ${err}`);
    } finally {
      setDrafting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Criterion header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{criterionDef.ref}</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">{criterionDef.text}</p>
      </div>

      {/* AI inferred banner */}
      {cs?.confidence === "ai-inferred" && cs.level !== "notEvaluated" && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-300 px-4 py-3 text-sm text-yellow-800">
          <strong>AI inferred</strong> — This level was inferred from scanner evidence only. Please review and confirm.
        </div>
      )}

      {/* Evidence */}
      {cs?.evidence && cs.evidence.length > 0 && (() => {
        const sig = getEvidenceSignal(cs.evidence);
        const scannerEvidence = cs.evidence.filter((e) => e.source === "source-scan" || e.source === "runtime-scan");
        const interviewEvidence = cs.evidence.filter((e) => e.source === "interview");

        return (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Evidence ({cs.evidence.length})</h3>

            {/* Signal summary banner */}
            {sig.scannerCount > 0 && (
              <div className="rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <strong>⚠ {sig.scannerCount} accessibility issue{sig.scannerCount !== 1 ? "s" : ""} detected</strong>
                    {" — "}scanner evidence suggests this criterion is likely <strong>not fully supported</strong>.
                  </div>
                  {cs.level === "notEvaluated" && (
                    <Tooltip text="Ask Claude to assess this criterion based on the scanner findings">
                      <button
                        onClick={draftOnly}
                        disabled={drafting}
                        className="shrink-0 py-1 px-3 rounded bg-orange-700 text-white text-xs font-medium hover:bg-orange-800 disabled:opacity-50"
                      >
                        {drafting ? "Drafting…" : "AI Draft"}
                      </button>
                    </Tooltip>
                  )}
                </div>
              </div>
            )}
            {sig.scannerCount === 0 && sig.interviewCount > 0 && (
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
                <strong>✎ Interview response provided</strong> — no scanner issues detected for this criterion.
              </div>
            )}

            {/* Scanner violations */}
            {scannerEvidence.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1.5">Scanner findings</p>
                <ul className="space-y-1.5">
                  {scannerEvidence.map((e, i) => (
                    <li key={i} className="text-xs text-orange-900 bg-orange-50 border border-orange-200 rounded px-3 py-2">
                      <span className="font-medium">{e.detail}</span>
                      {e.ref && <span className="block text-orange-400 mt-0.5 font-mono text-[10px] break-all">{e.ref}</span>}
                      <FindingActions evidence={e} criterionRef={criterionDef.ref} criterionText={criterionDef.text} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Interview responses */}
            {interviewEvidence.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">Interview responses</p>
                <ul className="space-y-1.5">
                  {interviewEvidence.map((e, i) => (
                    <li key={i} className="text-xs text-blue-900 bg-blue-50 border border-blue-100 rounded px-3 py-2">
                      {e.detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })()}

      {/* Interview question */}
      {criterionDef.interviewQuestion && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Interview Question</h3>
          <p className="text-sm text-gray-700 bg-blue-50 rounded-lg px-4 py-3 border border-blue-100">{criterionDef.interviewQuestion}</p>
          <div className="mt-3 space-y-1.5">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <textarea
                  aria-label="Your answer to the interview question"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                  placeholder="Your answer…"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Tooltip text="Save your answer as evidence, then ask Claude to draft the conformance assessment">
                  <button
                    onClick={submitAnswer}
                    disabled={!answer.trim() || saving || drafting}
                    className="py-2 px-3 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {drafting ? "Drafting…" : "Answer + AI draft"}
                  </button>
                </Tooltip>
                <Tooltip text="Mark this criterion as Not Applicable and save immediately">
                  <button
                  onClick={async () => {
                    setSaving(true);
                    setError(null);
                    try {
                      const res = await fetch("/api/criterion", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ criterionId, level: "notApplicable", remark: "Not applicable to this product." }),
                      });
                      if (!res.ok) throw new Error(await res.text());
                      const updated = await res.json() as CriterionState;
                      setLevel("notApplicable");
                      setRemark("Not applicable to this product.");
                      onUpdate(criterionId, updated);
                      onStatus("info", `${criterionDef.ref} marked Not Applicable.`);
                    } catch (err) {
                      setError(String(err));
                      onStatus("error", `Skip failed for ${criterionDef.ref}: ${err}`);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  className="py-2 px-3 rounded-lg bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 disabled:opacity-50"
                >
                  Skip / N/A
                </button>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conformance editor */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">Conformance</h3>
        <div>
          <label htmlFor="conformance-level" className="block text-xs text-gray-600">
            Level
            <select
              id="conformance-level"
              className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={level}
              onChange={(e) => setLevel(e.target.value as ConformanceLevel)}
              onBlur={(e) => setLevel(e.target.value as ConformanceLevel)}
            >
              {Object.entries(LEVEL_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <label htmlFor="conformance-remark" className="block text-xs text-gray-600">
            Remarks & Explanations
            <textarea
              id="conformance-remark"
              aria-label="Remarks and Explanations"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-28 resize-y"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Vendor remarks…"
            />
          </label>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex items-center gap-2 flex-wrap">
          <Tooltip text="Save the current level and remarks, marking this criterion as PM-confirmed">
            <button onClick={save} disabled={saving} className="py-2 px-4 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {saving ? "Saving…" : "Confirm & save"}
            </button>
          </Tooltip>
          <Tooltip text="Ask Claude to draft a conformance assessment from all available evidence">
            <button onClick={draftOnly} disabled={drafting} className="py-2 px-4 rounded-lg bg-white border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50">
              {drafting ? "Drafting…" : "AI draft"}
            </button>
          </Tooltip>
          {cs?.level !== "notEvaluated" && (
            <Tooltip text="Clear the current assessment and return this criterion to unevaluated" className="ml-auto">
              <button
                onClick={resetCriterion}
                disabled={saving}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
              >
                Reset to Not Evaluated
              </button>
            </Tooltip>
          )}
        </div>
        {cs?.confidence === "pm-confirmed" && (
          <p className="text-xs text-green-600">✓ PM confirmed</p>
        )}
      </div>
    </div>
  );
}
