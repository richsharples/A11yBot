"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  onConfirmAndNext,
}: {
  criterionId: string;
  criterionDef: { id: string; ref: string; text: string; interviewQuestion?: string };
  cs: CriterionState;
  onUpdate: (id: string, cs: CriterionState) => void;
  onStatus: PushStatus;
  onResolveStatus: ResolveStatus;
  onConfirmAndNext?: () => void;
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

  const save = async (): Promise<boolean> => {
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
      return true;
    } catch (err) {
      setError(String(err));
      onStatus("error", `Save failed for ${criterionDef.ref}: ${err}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Optimistic save — update UI instantly, persist in background
  const saveAndNext = useCallback(() => {
    if (!onConfirmAndNext) return;
    // Immediately synthesise the pm-confirmed state so the UI updates now
    const optimistic: CriterionState = {
      ...cs,
      level,
      remark,
      confidence: "pm-confirmed",
      history: [...(cs?.history ?? []), { at: new Date().toISOString(), level: cs?.level ?? "notEvaluated", remark: cs?.remark ?? "" }],
    };
    onUpdate(criterionId, optimistic);
    onConfirmAndNext();
    // Persist in background — show error if it fails but don't block navigation
    fetch("/api/criterion", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criterionId, level, remark }),
    }).then((r) => {
      if (!r.ok) onStatus("error", `Save failed for ${criterionDef.ref} — please re-confirm`);
    }).catch(() => onStatus("error", `Save failed for ${criterionDef.ref} — please re-confirm`));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criterionId, level, remark, cs, onConfirmAndNext, onUpdate, onStatus, criterionDef.ref]);

  // Space = confirm & next (only when review queue is active and focus isn't in a field)
  useEffect(() => {
    if (!onConfirmAndNext) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      saveAndNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onConfirmAndNext, saveAndNext]);

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

            {/* Scanner violations — grouped by rule so duplicate messages collapse */}
            {scannerEvidence.length > 0 && (() => {
              const groups = new Map<string, typeof scannerEvidence>();
              for (const e of scannerEvidence) {
                const key = e.rawId ?? e.detail;
                groups.set(key, [...(groups.get(key) ?? []), e]);
              }
              return (
                <div>
                  <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1.5">
                    Scanner findings ({groups.size} rule{groups.size !== 1 ? "s" : ""}, {scannerEvidence.length} instance{scannerEvidence.length !== 1 ? "s" : ""})
                  </p>
                  <ul className="space-y-1.5">
                    {[...groups.entries()].map(([key, items]) => (
                      <li key={key} className="text-xs text-orange-900 bg-orange-50 border border-orange-200 rounded px-3 py-2">
                        <span className="font-medium">{items[0].detail}</span>
                        {items.some((e) => e.ref) && (
                          <ul className="mt-1.5 space-y-0.5">
                            {items.filter((e) => e.ref).map((e, i) => (
                              <li key={i} className="text-orange-400 font-mono text-[10px] break-all">
                                {items.length > 1 && <span className="text-orange-300 mr-1">↳</span>}{e.ref}
                              </li>
                            ))}
                          </ul>
                        )}
                        <FindingActions evidence={items[0]} criterionRef={criterionDef.ref} criterionText={criterionDef.text} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

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
          {onConfirmAndNext ? (
            <>
              <Tooltip text="Confirm this assessment and move to the next item to review  [Space]">
                <button onClick={saveAndNext} disabled={saving} className="py-2 px-4 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  {saving ? "Saving…" : "Confirm & next →"}
                </button>
              </Tooltip>
              <Tooltip text="Save without advancing — stay on this criterion">
                <button onClick={save} disabled={saving} className="py-2 px-3 rounded-lg bg-white border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50 text-gray-600">
                  {saving ? "…" : "Save only"}
                </button>
              </Tooltip>
            </>
          ) : (
            <Tooltip text="Save the current level and remarks, marking this criterion as PM-confirmed">
              <button onClick={save} disabled={saving} className="py-2 px-4 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {saving ? "Saving…" : "Confirm & save"}
              </button>
            </Tooltip>
          )}
          <Tooltip text="Ask Claude to draft a conformance assessment from all available evidence">
            <button onClick={draftOnly} disabled={drafting} className="py-2 px-4 rounded-lg bg-white border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50">
              {drafting ? "Drafting…" : "AI draft"}
            </button>
          </Tooltip>
          {cs?.level !== "notEvaluated" && (
            <Tooltip text="Clear the current assessment and return this criterion to unevaluated" className="ml-auto">
              <button onClick={resetCriterion} disabled={saving} className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
                Reset
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
