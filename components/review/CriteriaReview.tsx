"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Project, CriterionState } from "@/src/types";
import { StatusEntry, StatusLevel, PushStatus, ResolveStatus, CriteriaData, LEVEL_LABELS, LEVEL_COLORS, getEvidenceSignal } from "./types";
import { Tooltip } from "./Tooltip";
import { StatusBar } from "./StatusBar";
import { CriterionDetail } from "./CriterionDetail";
import pkg from "../../package.json";
import { LogoLockup } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Badge } from "@/components/ui/Badge";

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
  const [scanningSource, setScanningSource] = useState(false);
  const [scanningRuntime, setScanningRuntime] = useState(false);
  const initialScanDone = useRef(false);
  const [draftingAll, setDraftingAll] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const [draftTotal, setDraftTotal] = useState(0);
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

  const updateStatus = useCallback((id: number, message: string) => {
    setStatusLog((prev) => prev.map((e) => e.id === id ? { ...e, message } : e));
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

  // Auto-run applicable scans once on mount
  useEffect(() => {
    if (initialScanDone.current) return;
    initialScanDone.current = true;
    const hasSource = (project.mode === "source" || project.mode === "hybrid") && project.sourcePath;
    const hasRuntime = (project.mode === "runtime" || project.mode === "hybrid") && project.runtimeUrl;
    if (hasSource) runSourceScan();
    if (hasRuntime) runRuntimeScan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setScanningSource(true);
    const sid = pushStatus("running", "Source scan running…");
    try {
      const res = await fetch("/api/scan/source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePath: project.sourcePath }),
      });
      const data = await res.json();
      const filesScanned = Object.values(data.scanned as Record<string, number>).reduce((a, b) => a + b, 0);
      const resetNote = data.aiInferredReset > 0 ? ` ${data.aiInferredReset} AI-inferred criteria reset — run Draft All to regenerate.` : "";
      resolveStatus(sid, "info", `Source scan done — ${filesScanned} files scanned, ${data.evidenceAdded} evidence items across ${data.criteriaWithEvidence} criteria.${resetNote}`);
      const p = await fetch("/api/projects/active").then((r) => r.json());
      onProjectUpdate({ criteria: p.criteria });
    } catch (err) {
      resolveStatus(sid, "error", `Source scan failed: ${err}`);
    } finally {
      setScanningSource(false);
    }
  }, [project.sourcePath, onProjectUpdate, pushStatus, resolveStatus]);

  const runRuntimeScan = useCallback(async () => {
    if (!project.runtimeUrl) return;
    setScanningRuntime(true);
    const sid = pushStatus("running", "AppScan running — Lighthouse + axe (0s)…");
    const started = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.round((Date.now() - started) / 1000);
      updateStatus(sid, `AppScan running — Lighthouse + axe (${elapsed}s)…`);
    }, 1000);
    try {
      const res = await fetch("/api/scan/runtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: project.runtimeUrl }),
      });
      const data = await res.json();
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      const resetNote = data.aiInferredReset > 0 ? ` ${data.aiInferredReset} AI-inferred criteria reset — run Draft All to regenerate.` : "";
      resolveStatus(sid, "info", `AppScan done in ${elapsed}s — ${data.evidenceAdded} evidence items across ${data.pathsScanned} path(s).${resetNote}`);
      const p = await fetch("/api/projects/active").then((r) => r.json());
      onProjectUpdate({ criteria: p.criteria });
    } catch (err) {
      resolveStatus(sid, "error", `AppScan failed: ${err}`);
    } finally {
      clearInterval(timer);
      setScanningRuntime(false);
    }
  }, [project.runtimeUrl, onProjectUpdate, pushStatus, resolveStatus]);

  const draftAll = useCallback(async () => {
    if (!criteriaData) return;
    // Only draft criteria not yet attempted — ai-attempted means AI tried but needs more evidence
    const toDraft = Object.entries(project.criteria)
      .filter(([, cs]) => cs.level === "notEvaluated" && cs.confidence !== "ai-attempted")
      .map(([id]) => id);
    if (toDraft.length === 0) return;

    setDraftingAll(true);
    setDraftCount(0);
    setDraftTotal(toDraft.length);
    pushStatus("running", `AI drafting ${toDraft.length} criteria…`);

    // Build a ref lookup for friendly log messages
    const refById: Record<string, string> = {};
    for (const ch of criteriaData.chapters) {
      for (const c of ch.criteria) refById[c.id] = c.ref;
    }

    let completed = 0;
    let failed = 0;
    let completedAsNotEval = 0;
    // Local models (Ollama) have one GPU — parallel requests queue internally
    // and cause VRAM thrashing. Serial is faster for local; parallel for cloud.
    const providerRes = await fetch("/api/ai/provider").then((r) => r.ok ? r.json() : null).catch(() => null);
    const isLocal = providerRes?.current?.provider === "ollama";
    const BATCH = isLocal ? 1 : 5;

    for (let i = 0; i < toDraft.length; i += BATCH) {
      const batch = toDraft.slice(i, i + BATCH);
      await Promise.all(batch.map(async (criterionId) => {
        const t0 = Date.now();
        try {
          const res = await fetch("/api/ai/draft", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ criterionId }),
          });
          if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "failed");
          const cs = await res.json() as CriterionState;
          // draftCriterion swallows LLM errors and returns notEvaluated with the error in the remark
          if (cs.remark.startsWith("AI draft failed:")) throw new Error(cs.remark.replace("AI draft failed: ", ""));
          onCriterionUpdate(criterionId, cs);
          completed++;
          if (cs.level === "notEvaluated") completedAsNotEval++;
          setDraftCount(completed);
          const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
          pushStatus("info", `${refById[criterionId] ?? criterionId} — ${cs.level} (${elapsed}s)`);
        } catch (err) {
          failed++;
          completed++;
          setDraftCount(completed);
          const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
          pushStatus("error", `${refById[criterionId] ?? criterionId} — failed (${elapsed}s): ${err}`);
        }
      }));
    }

    const withLevel = (toDraft.length - failed) - completedAsNotEval;
    pushStatus(failed > 0 ? "warn" : "info",
      `AI draft complete — ${withLevel} assessed with a conformance level${completedAsNotEval > 0 ? `, ${completedAsNotEval} need scan or interview evidence before AI can assess` : ""}${failed > 0 ? `, ${failed} failed — click "AI draft all" to retry` : ""}.`);
    setDraftingAll(false);
    setDraftCount(0);
    setDraftTotal(0);
  }, [criteriaData, project.criteria, onCriterionUpdate, pushStatus]);

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
    return <div className="min-h-screen flex items-center justify-center text-ink-3">Loading criteria…</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-rule px-6 pt-3.5 pb-0 sticky top-0 z-10">
        {/* Row 1: identity + progress + actions */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-3">
            <Tooltip text={`v${pkg.version}`} side="bottom">
              <span className="cursor-default"><LogoLockup size={48} /></span>
            </Tooltip>
            <span className="text-rule">|</span>
            <div>
              <span className="eyebrow">Product</span>
              <span className="ml-1.5 text-small font-medium text-ink-1">{project.productName} {project.productVersion}</span>
            </div>
            <span className="text-rule">|</span>
            <Tooltip text={showSources ? "Hide compliance sources" : `View compliance sources${criteriaStatus ? ` · v${criteriaStatus.manifest.criteriaVersion}` : ""}`} side="bottom">
              <Button variant={showSources ? "secondary" : "ghost"} onClick={() => setShowSources((s) => !s)} className={showSources ? "border-accent-rule text-accent" : ""}>
                Standard: {project.edition}
              </Button>
            </Tooltip>
          </div>
          <div className="flex items-center gap-2">
            {/* Review progress + navigator */}
            {(() => {
              const reviewTotal = confirmed + reviewList.length;
              const pct = reviewTotal > 0 ? Math.round((confirmed / reviewTotal) * 100) : 0;
              return (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  {reviewList.length > 0 ? (
                    <>
                      <span className="text-small text-ink-3">
                        <span className="font-medium text-ink-1">{reviewList.length} of {reviewTotal}</span> to review
                      </span>
                      <Tooltip text="Previous item to review" side="bottom">
                        <Button variant="secondary" onClick={() => navigateReview(-1)} disabled={reviewIdx === 0} aria-label="Previous item to review">&lt;</Button>
                      </Tooltip>
                      <Tooltip text="Next item to review" side="bottom">
                        <Button variant="secondary" onClick={() => navigateReview(1)} disabled={reviewIdx === reviewList.length - 1} aria-label="Next item to review">&gt;</Button>
                      </Tooltip>
                    </>
                  ) : confirmed > 0 ? (
                    <span className="text-small text-ok font-medium">✓ {confirmed} reviewed</span>
                  ) : (
                    <span className="text-small text-ink-3"><span className="font-medium text-ink-2">{evaluated}/{totalCriteria}</span> evaluated</span>
                  )}
                </div>
              );
            })()}
            <Tooltip text="Generate and download the VPAT as a .docx file" side="bottom">
              <Button variant="primary" onClick={handleExport} disabled={exporting}>
                {exporting ? "Generating…" : "Create report"}
              </Button>
            </Tooltip>
            <Tooltip text="Settings" side="bottom">
              <Button variant="secondary" onClick={onOpenSettings} aria-label="Open settings">
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* Row 2: action buttons as tab spine */}
        <div className="flex items-center gap-1 border-t border-rule pt-1">
          {((project.mode === "source" || project.mode === "hybrid") && project.sourcePath) ||
           ((project.mode === "runtime" || project.mode === "hybrid") && project.runtimeUrl) ? (
            <Tooltip text="Re-run all applicable scans to pick up code changes" side="bottom">
              <Button variant="ghost"
                onClick={() => {
                  if ((project.mode === "source" || project.mode === "hybrid") && project.sourcePath) runSourceScan();
                  if ((project.mode === "runtime" || project.mode === "hybrid") && project.runtimeUrl) runRuntimeScan();
                }}
                disabled={scanningSource || scanningRuntime}
              >
                {(scanningSource || scanningRuntime) ? "Scanning…" : "Re-scan"}
              </Button>
            </Tooltip>
          ) : null}
          <Tooltip text="Send all unevaluated criteria to A11yBot for automated AI assessment" side="bottom">
            <Button variant="secondary" onClick={draftAll} disabled={draftingAll || scanningSource || scanningRuntime}>
              {draftingAll ? `Drafting… ${draftCount}/${draftTotal}` : `AI draft all (${Object.values(project.criteria).filter((c) => c.level === "notEvaluated" && c.confidence !== "ai-attempted").length} remaining)`}
            </Button>
          </Tooltip>
          <div className="ml-auto">
            <Tooltip text="Discard this session and start a new VPAT project" side="bottom">
              <Button variant="ghost" onClick={() => setConfirmNewProject(true)} className="text-ink-4 hover:text-issue">
                New project
              </Button>
            </Tooltip>
          </div>
        </div>
      </header>

      {/* Criteria sources panel */}
      {showSources && criteriaStatus && (
        <div className="bg-surface-2 border-b border-rule px-6 py-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <span className="eyebrow">Compliance Standards</span>
              <span className="ml-2 text-caption text-ink-4">
                Criteria v{criteriaStatus.manifest.criteriaVersion} · Released {criteriaStatus.manifest.releasedAt}
                {criteriaStatus.lastChecked && ` · Checked ${new Date(criteriaStatus.lastChecked).toLocaleDateString()}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {criteriaStatus.manifest.checkUrl && (
                <Tooltip text="Check for updated criteria files now">
                  <Button variant="secondary" size="sm" onClick={handleCheckUpdate} disabled={checkingUpdate}>
                    {checkingUpdate ? "Checking…" : "Check for updates"}
                  </Button>
                </Tooltip>
              )}
              <Button variant="ghost" onClick={() => setShowSources(false)} aria-label="Close">✕</Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {criteriaStatus.manifest.sources
              .filter((s) => s.editions.includes(project.edition))
              .map((source) => (
                <a key={source.abbr} href={source.url} target="_blank" rel="noopener noreferrer"
                  className="block rounded-md border border-rule bg-surface px-3 py-2.5 hover:border-accent-rule hover:bg-accent-soft transition-colors group">
                  <div className="flex items-center gap-2">
                    <span className="text-caption font-semibold text-accent group-hover:underline">{source.abbr}</span>
                    <span className="text-caption text-ink-4">↗</span>
                  </div>
                  <p className="text-caption text-ink-3 mt-0.5 leading-snug">{source.description}</p>
                </a>
              ))}
          </div>
          {criteriaStatus.manifest.notes && (
            <p className="mt-3 text-small text-warn bg-warn-bg border border-warn-rule rounded-md px-3 py-2">⚠ {criteriaStatus.manifest.notes}</p>
          )}
          <p className="mt-2 text-caption text-ink-4">Stored at: <code className="font-mono">{criteriaStatus.storeDir}</code></p>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chapter sidebar */}
        <nav className="w-64 bg-surface border-r border-rule overflow-y-auto flex-shrink-0">
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
            const unconfirmedNA = chapterCriteria.filter((c) => c.level === "notApplicable" && c.confidence !== "pm-confirmed");

            return (
              <div key={chapter.id} className="border-b border-rule-2">
              <button
                onClick={() => { setSelectedChapter(chapter.id); setSelectedCriterion(null); }}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  allNA
                    ? "opacity-40 cursor-default hover:bg-transparent"
                    : `hover:bg-surface-2 ${selectedChapter === chapter.id ? "bg-accent-soft border-l-2 border-l-accent" : ""}`
                }`}
              >
                <div className={`text-small font-medium leading-tight ${allNA ? "text-ink-4" : "text-ink-1"}`}>
                  {chapter.title}
                </div>
                {allNA ? (
                  <Badge variant="neutral" className="mt-0.5">Not applicable</Badge>
                ) : (
                  <>
                    <div className="text-caption text-ink-3 mt-0.5">{chapterEval}/{chapterApplicable.length} evaluated</div>
                    {totalScannerEvidence > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <Badge variant="issue" icon="!">
                          {totalScannerEvidence} issue{totalScannerEvidence !== 1 ? "s" : ""} pending
                        </Badge>
                        {sourceCount > 0 && <Badge variant="issue">{sourceCount} source</Badge>}
                        {appScanCount > 0 && <Badge variant="issue">{appScanCount} app</Badge>}
                      </div>
                    )}
                  </>
                )}
              </button>
              {/* Bulk confirm N/A */}
              {!allNA && unconfirmedNA.length > 0 && unconfirmedNA.length === chapterCriteria.length && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    for (const cs of unconfirmedNA) {
                      const res = await fetch("/api/criterion", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ criterionId: cs.id, level: "notApplicable", remark: cs.remark }),
                      });
                      if (res.ok) {
                        const updated = await res.json() as import("@/src/types").CriterionState;
                        onCriterionUpdate(cs.id, updated);
                      }
                    }
                    pushStatus("info", `${chapter.title} — ${unconfirmedNA.length} N/A criteria confirmed.`);
                  }}
                  className="w-full px-4 py-1.5 text-left text-caption text-accent hover:bg-accent-soft border-b border-rule-2 transition-colors"
                >
                  ✓ Confirm all N/A ({unconfirmedNA.length})
                </button>
              )}
              </div>
            );
          })}
        </nav>

        {/* Criteria list + detail panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* Criteria list */}
          {selectedChapter && (
            <div className="w-80 bg-surface border-r border-rule overflow-y-auto flex-shrink-0">
              {criteriaData.chapters.find((c) => c.id === selectedChapter)?.criteria.map((criterion) => {
                const cs = project.criteria[criterion.id];
                return (
                  <button
                    key={criterion.id}
                    aria-label={criterion.ref}
                    onClick={() => setSelectedCriterion(criterion.id)}
                    className={`w-full text-left px-4 py-3 border-b border-rule-2 hover:bg-surface-2 transition-colors ${selectedCriterion === criterion.id ? "bg-accent-soft border-l-2 border-l-accent" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      <Chip level={cs?.level ?? "notEvaluated"} className="mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-small font-medium text-ink-1 leading-tight">{criterion.ref}</div>
                        {cs?.confidence === "ai-inferred" && cs.level !== "notEvaluated" && (
                          <Badge variant="warn" icon="~" className="mt-0.5">AI inferred</Badge>
                        )}
                        {cs?.evidence && cs.evidence.length > 0 && (() => {
                          const sig = getEvidenceSignal(cs.evidence);
                          return (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {sig.scannerCount > 0 && (
                                <Badge variant="issue" icon="!">
                                  {sig.scannerCount} issue{sig.scannerCount !== 1 ? "s" : ""}
                                </Badge>
                              )}
                              {sig.interviewCount > 0 && (
                                <Badge variant="accent" icon="✎">interviewed</Badge>
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
                onConfirmAndNext={reviewList.length > 0 ? () => navigateReview(1) : undefined}
              />
            ) : selectedChapter ? (
              <div className="text-small text-ink-3">Select a criterion from the list.</div>
            ) : (
              <div className="text-small text-ink-3">Select a chapter from the sidebar to begin.</div>
            )}
          </div>
        </div>
      </div>

      <StatusBar entries={statusLog} onClear={() => setStatusLog([])} forceExpanded={draftingAll} />

      {confirmNewProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-surface border border-rule rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-title text-ink-1 font-semibold mb-2">Start a new project?</h2>
            <p className="text-body text-ink-2 leading-relaxed mb-6">
              All current compliance information will be lost. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setConfirmNewProject(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => {
                setConfirmNewProject(false);
                fetch("/api/projects/active", { method: "DELETE" }).finally(() => onNewProject());
              }}>
                Discard &amp; start new
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
