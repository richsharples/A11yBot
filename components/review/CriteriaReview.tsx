"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Project, CriterionState } from "@/src/types";
import { StatusEntry, StatusLevel, PushStatus, ResolveStatus, CriteriaData, LEVEL_LABELS, LEVEL_COLORS, getEvidenceSignal } from "./types";
import { Tooltip } from "./Tooltip";
import { StatusBar } from "./StatusBar";
import { ProgressBar } from "./ProgressBar";
import { CriterionDetail } from "./CriterionDetail";
import pkg from "../../package.json";

// Inlined to avoid importing from server-only module
interface CriteriaManifest {
  criteriaVersion: string;
  releasedAt: string;
  notes: string;
  checkedAt?: string | null;
  checkUrl: string;
  sources: { name: string; abbr: string; url: string; description: string; editions: string[] }[];
}

interface CriteriaStatus {
  manifest: CriteriaManifest;
  storeDir: string;
  updateAvailable: boolean;
  remoteVersion: string | null;
  lastChecked: string | null;
  seededAt: string | null;
}

interface Props {
  project: Project;
  onCriterionUpdate: (id: string, cs: CriterionState) => void;
  onProjectUpdate: (updates: Partial<Project>) => void;
  onNewProject: () => void;
  onOpenSettings: () => void;
}

export function CriteriaReview({ project, onCriterionUpdate, onProjectUpdate, onNewProject, onOpenSettings }: Props) {
  const [criteriaData, setCriteriaData] = useState<CriteriaData | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [selectedCriterion, setSelectedCriterion] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [draftingAll, setDraftingAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [statusLog, setStatusLog] = useState<StatusEntry[]>([]);
  const [criteriaStatus, setCriteriaStatus] = useState<CriteriaStatus | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [confirmNewProject, setConfirmNewProject] = useState(false);
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
      const filesScanned = Object.values(data.scanned as Record<string, number>).reduce((a, b) => a + b, 0);
      resolveStatus(sid, "info", `Source scan done — ${filesScanned} files scanned, ${data.evidenceAdded} evidence items across ${data.criteriaWithEvidence} criteria.`);
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

  const applicableCriteria = Object.values(project.criteria).filter((c) => c.level !== "notApplicable");
  const totalCriteria = applicableCriteria.length;
  const evaluated = applicableCriteria.filter((c) => c.level !== "notEvaluated").length;
  const confirmed = applicableCriteria.filter((c) => c.confidence === "pm-confirmed").length;

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
      <header className="bg-[#0b1a0d] border-b border-[#39FF14]/10 px-6 py-3 sticky top-0 z-10 font-mono">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-[#39FF14] tracking-wide" style={{ textShadow: "0 0 8px #39FF14aa" }}>A11yBot</span>
            <span className="px-1.5 py-0.5 rounded bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] text-[10px] font-semibold">v{pkg.version}</span>
            <span className="text-[#39FF14]/20">|</span>
            <span className="text-sm text-[#39FF14]/50"><span className="font-medium text-[#39FF14]/70">Product Name:</span> {project.productName} {project.productVersion}</span>
            <span className="text-[#39FF14]/20">|</span>
            <span className="text-sm text-[#39FF14]/50"><span className="font-medium text-[#39FF14]/70">VPAT Type:</span> {project.edition}</span>
            <span className="text-[#39FF14]/20">|</span>
            <span className="text-sm text-[#39FF14]/50"><span className="font-medium text-[#39FF14]/70">Date:</span> {new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
          </div>
          <div className="flex items-center gap-3">
            <ProgressBar evaluated={evaluated} total={totalCriteria} confirmed={confirmed} />
            {reviewList.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-yellow-300 bg-yellow-900/40 border border-yellow-500/30 rounded px-2 py-1.5 font-mono">
                <span className="font-medium">AI review</span>
                <span className="text-yellow-400/80 ml-1">
                  {reviewIdx !== null ? `${reviewIdx + 1}/${reviewList.length}` : reviewList.length}
                </span>
                <Tooltip text="Previous AI-inferred criterion" side="bottom">
                  <button onClick={() => navigateReview(-1)} disabled={reviewIdx === 0} className="px-1 hover:text-yellow-100 disabled:opacity-30 disabled:cursor-default" aria-label="Previous AI-inferred criterion">←</button>
                </Tooltip>
                <Tooltip text="Next AI-inferred criterion" side="bottom">
                  <button onClick={() => navigateReview(1)} disabled={reviewIdx === reviewList.length - 1} className="px-1 hover:text-yellow-100 disabled:opacity-30 disabled:cursor-default" aria-label="Next AI-inferred criterion">→</button>
                </Tooltip>
              </div>
            )}
            {reviewList.length === 0 && confirmed > 0 && (
              <span className="text-xs text-[#39FF14]/60 border border-[#39FF14]/20 rounded px-2 py-1.5">✓ All reviewed</span>
            )}
            <Tooltip text="Download the completed VPAT as a .docx file" side="bottom">
              <button onClick={handleExport} disabled={exporting} className="py-2 px-4 rounded-lg bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] text-sm font-medium hover:bg-[#39FF14]/20 disabled:opacity-40 transition-colors">
                {exporting ? "Exporting…" : "Export .docx"}
              </button>
            </Tooltip>
            <Tooltip text="Settings" side="bottom">
              <button onClick={onOpenSettings} className="py-2 px-2 rounded-lg bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] hover:bg-[#39FF14]/20 transition-colors" aria-label="Open settings">
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
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
          <button onClick={() => setConfirmNewProject(true)} className="py-1.5 px-3 rounded bg-white border border-gray-300 text-sm hover:bg-gray-50 text-gray-500">
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
            const chapterApplicable = chapterCriteria.filter((c) => c.level !== "notApplicable");
            const chapterEval = chapterApplicable.filter((c) => c.level !== "notEvaluated").length;

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

            const allNA = chapterApplicable.length === 0;

            return (
              <button
                key={chapter.id}
                onClick={() => { setSelectedChapter(chapter.id); setSelectedCriterion(null); }}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors ${
                  allNA
                    ? "opacity-40 cursor-default hover:bg-transparent"
                    : `hover:bg-gray-50 ${selectedChapter === chapter.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`
                }`}
              >
                <div className={`text-sm font-medium leading-tight ${allNA ? "text-gray-400" : "text-gray-900"}`}>
                  {chapter.title}
                </div>
                {allNA ? (
                  <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-400">
                    Not applicable
                  </span>
                ) : (
                  <>
                    <div className="text-xs text-gray-500 mt-0.5">{chapterEval}/{chapterApplicable.length} evaluated</div>
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
                  </>
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

      {confirmNewProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0b1a0d] border border-[#39FF14]/20 rounded-xl shadow-2xl p-6 w-full max-w-sm font-mono" style={{ boxShadow: "0 0 40px #39FF1418" }}>
            <h2 className="text-[#39FF14] font-bold text-base mb-2" style={{ textShadow: "0 0 8px #39FF14aa" }}>Start a new project?</h2>
            <p className="text-[#39FF14]/60 text-sm leading-relaxed mb-6">
              All current compliance information will be lost. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmNewProject(false)}
                className="py-2 px-4 rounded-lg bg-[#39FF14]/5 border border-[#39FF14]/20 text-[#39FF14]/60 text-sm hover:bg-[#39FF14]/10 hover:text-[#39FF14]/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmNewProject(false);
                  fetch("/api/project", { method: "DELETE" }).finally(() => onNewProject());
                }}
                className="py-2 px-4 rounded-lg bg-red-900/40 border border-red-500/40 text-red-300 text-sm hover:bg-red-900/60 hover:text-red-200 transition-colors"
              >
                Discard &amp; start new
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
