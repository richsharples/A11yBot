"use client";

import React, { useState, useEffect } from "react";
import type { CriterionState, ConformanceLevel } from "@/src/types";
import { LEVEL_LABELS, LEVEL_COLORS, PushStatus, ResolveStatus, getEvidenceSignal } from "./types";
import { Tooltip } from "./Tooltip";
import { FindingActions } from "./FindingActions";

export function CriterionDetail({
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
