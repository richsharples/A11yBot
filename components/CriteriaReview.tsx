"use client";

import { useState, useEffect, useCallback } from "react";
import type { Project, CriterionState, ConformanceLevel } from "@/src/types";

interface Props {
  project: Project;
  onCriterionUpdate: (id: string, cs: CriterionState) => void;
  onProjectUpdate: (updates: Partial<Project>) => void;
  onNewProject: () => void;
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
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Fetch the criteria structure (not state) from our API
  useEffect(() => {
    fetch(`/api/criteria?edition=${project.edition}`)
      .then((r) => r.json())
      .then(setCriteriaData)
      .catch(() => {});
  }, [project.edition]);

  const runSourceScan = useCallback(async () => {
    if (!project.sourcePath) return;
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/scan/source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePath: project.sourcePath }),
      });
      const data = await res.json();
      setScanResult(`Source scan done — ${data.evidenceAdded} evidence items across ${data.criteriaWithEvidence} criteria.`);
      // Refresh project state
      const p = await fetch("/api/project").then((r) => r.json());
      onProjectUpdate({ criteria: p.criteria });
    } catch (err) {
      setScanResult(`Scan failed: ${err}`);
    } finally {
      setScanning(false);
    }
  }, [project.sourcePath, onProjectUpdate]);

  const runRuntimeScan = useCallback(async () => {
    if (!project.runtimeUrl) return;
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/scan/runtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: project.runtimeUrl }),
      });
      const data = await res.json();
      setScanResult(`Runtime scan done — ${data.evidenceAdded} evidence items across ${data.pathsScanned} path(s).`);
      const p = await fetch("/api/project").then((r) => r.json());
      onProjectUpdate({ criteria: p.criteria });
    } catch (err) {
      setScanResult(`Scan failed: ${err}`);
    } finally {
      setScanning(false);
    }
  }, [project.runtimeUrl, onProjectUpdate]);

  const draftAll = useCallback(async () => {
    setDraftingAll(true);
    setStatusMsg("AI is drafting all unevaluated criteria…");
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftAll: true }),
      });
      const data = await res.json();
      setStatusMsg(`Done — ${data.updated} criteria drafted.`);
      const p = await fetch("/api/project").then((r) => r.json());
      onProjectUpdate({ criteria: p.criteria });
    } catch (err) {
      setStatusMsg(`Draft failed: ${err}`);
    } finally {
      setDraftingAll(false);
    }
  }, [onProjectUpdate]);

  const handleExport = useCallback(async () => {
    setExporting(true);
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
    } catch (err) {
      setStatusMsg(`Export failed: ${err}`);
    } finally {
      setExporting(false);
    }
  }, []);

  const totalCriteria = Object.keys(project.criteria).length;
  const evaluated = Object.values(project.criteria).filter((c) => c.level !== "notEvaluated").length;
  const aiInferred = Object.values(project.criteria).filter((c) => c.confidence === "ai-inferred").length;
  const confirmed = Object.values(project.criteria).filter((c) => c.confidence === "pm-confirmed").length;

  if (!criteriaData) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading criteria…</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-semibold text-gray-900">{project.productName} {project.productVersion}</h1>
          <p className="text-xs text-gray-500">VPAT {project.edition} · {project.mode} mode</p>
        </div>
        <div className="flex items-center gap-3">
          <ProgressBar evaluated={evaluated} total={totalCriteria} confirmed={confirmed} />
          <button onClick={handleExport} disabled={exporting} className="py-2 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {exporting ? "Exporting…" : "Export .docx"}
          </button>
        </div>
      </header>

      {/* Scan / AI action bar */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center gap-3 flex-wrap">
        {(project.mode === "source" || project.mode === "hybrid") && project.sourcePath && (
          <button onClick={runSourceScan} disabled={scanning} className="py-1.5 px-3 rounded bg-white border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50">
            {scanning ? "Scanning…" : "Run source scan"}
          </button>
        )}
        {(project.mode === "runtime" || project.mode === "hybrid") && project.runtimeUrl && (
          <button onClick={runRuntimeScan} disabled={scanning} className="py-1.5 px-3 rounded bg-white border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50">
            {scanning ? "Scanning…" : "Run Lighthouse"}
          </button>
        )}
        <button onClick={draftAll} disabled={draftingAll} className="py-1.5 px-3 rounded bg-white border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50">
          {draftingAll ? "Drafting…" : `AI draft all (${totalCriteria - evaluated} remaining)`}
        </button>
        <button onClick={onNewProject} className="py-1.5 px-3 rounded bg-white border border-gray-300 text-sm hover:bg-gray-50 text-gray-500">
          New project
        </button>
        {(scanResult || statusMsg) && (
          <span className="text-sm text-gray-600 ml-2">{scanResult ?? statusMsg}</span>
        )}
        {aiInferred > 0 && (
          <span className="ml-auto text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
            {aiInferred} AI-inferred — review required
          </span>
        )}
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chapter sidebar */}
        <nav className="w-64 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
          {criteriaData.chapters.map((chapter) => {
            const chapterCriteria = chapter.criteria.map((c) => project.criteria[c.id]).filter(Boolean);
            const chapterEval = chapterCriteria.filter((c) => c.level !== "notEvaluated").length;
            return (
              <button
                key={chapter.id}
                onClick={() => { setSelectedChapter(chapter.id); setSelectedCriterion(null); }}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedChapter === chapter.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`}
              >
                <div className="text-sm font-medium text-gray-900 leading-tight">{chapter.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{chapterEval}/{chapter.criteria.length} evaluated</div>
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
                    onClick={() => setSelectedCriterion(criterion.id)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedCriterion === criterion.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 shrink-0 text-xs px-1.5 py-0.5 rounded border font-medium ${cs ? LEVEL_COLORS[cs.level] : LEVEL_COLORS.notEvaluated}`}>
                        {cs ? LEVEL_LABELS[cs.level].split(" ")[0] : "—"}
                      </span>
                      <div>
                        <div className="text-xs font-medium text-gray-900 leading-tight">{criterion.ref}</div>
                        {cs?.confidence === "ai-inferred" && cs.level !== "notEvaluated" && (
                          <span className="text-xs text-yellow-600">AI inferred</span>
                        )}
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
              />
            ) : selectedChapter ? (
              <div className="text-gray-500 text-sm">Select a criterion from the list.</div>
            ) : (
              <div className="text-gray-500 text-sm">Select a chapter from the sidebar to begin.</div>
            )}
          </div>
        </div>
      </div>
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
}: {
  criterionId: string;
  criterionDef: { id: string; ref: string; text: string; interviewQuestion?: string };
  cs: CriterionState;
  onUpdate: (id: string, cs: CriterionState) => void;
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
    } catch (err) {
      setError(String(err));
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
      // Auto-draft after interview answer
      setDrafting(true);
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
      }
      setAnswer("");
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
      setDrafting(false);
    }
  };

  const draftOnly = async () => {
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criterionId }),
      });
      if (!res.ok) throw new Error("AI draft failed");
      const updated = await res.json() as CriterionState;
      setLevel(updated.level);
      setRemark(updated.remark);
      onUpdate(criterionId, updated);
    } catch (err) {
      setError(String(err));
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
      {cs?.evidence && cs.evidence.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Evidence ({cs.evidence.length})</h3>
          <ul className="space-y-1.5">
            {cs.evidence.map((e, i) => (
              <li key={i} className="text-xs text-gray-600 bg-gray-50 rounded px-3 py-2">
                <span className="font-medium text-gray-800">[{e.source}]</span> {e.detail}
                {e.ref && <span className="block text-gray-400 mt-0.5">{e.ref}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Interview question */}
      {criterionDef.interviewQuestion && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Interview Question</h3>
          <p className="text-sm text-gray-700 bg-blue-50 rounded-lg px-4 py-3 border border-blue-100">{criterionDef.interviewQuestion}</p>
          <div className="mt-3 flex gap-2">
            <textarea
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
              placeholder="Your answer…"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={submitAnswer}
                disabled={!answer.trim() || saving || drafting}
                className="py-2 px-3 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {drafting ? "Drafting…" : "Answer + AI draft"}
              </button>
              <button
                onClick={() => setAnswer("Not applicable to this product.")}
                className="py-2 px-3 rounded-lg bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
              >
                Skip / N/A
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conformance editor */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">Conformance</h3>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Level</label>
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={level}
            onChange={(e) => setLevel(e.target.value as ConformanceLevel)}
          >
            {Object.entries(LEVEL_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Remarks & Explanations</label>
          <textarea
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-28 resize-y"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Vendor remarks…"
          />
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="py-2 px-4 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {saving ? "Saving…" : "Confirm & save"}
          </button>
          <button onClick={draftOnly} disabled={drafting} className="py-2 px-4 rounded-lg bg-white border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50">
            {drafting ? "Drafting…" : "AI draft"}
          </button>
        </div>
        {cs?.confidence === "pm-confirmed" && (
          <p className="text-xs text-green-600">✓ PM confirmed</p>
        )}
      </div>
    </div>
  );
}
