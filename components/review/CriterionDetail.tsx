"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { CriterionState, ConformanceLevel } from "@/src/types";
import { LEVEL_LABELS, LEVEL_COLORS, PushStatus, ResolveStatus, getEvidenceSignal } from "./types";
import { Tooltip } from "./Tooltip";
import { FindingActions } from "./FindingActions";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { Chip } from "@/components/ui/Chip";

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
        <h2 className="text-heading font-semibold text-ink-1">{criterionDef.ref}</h2>
        <p className="mt-2 text-body text-ink-2 leading-relaxed">{criterionDef.text}</p>
      </div>

      {/* AI inferred banner */}
      {cs?.confidence === "ai-inferred" && cs.level !== "notEvaluated" && (
        <Banner variant="warn">
          <strong>AI inferred</strong> — This level was inferred from scanner evidence only. Please review and confirm.
        </Banner>
      )}

      {/* Evidence */}
      {cs?.evidence && cs.evidence.length > 0 && (() => {
        const sig = getEvidenceSignal(cs.evidence);
        const scannerEvidence = cs.evidence.filter((e) => e.source === "source-scan" || e.source === "runtime-scan");
        const interviewEvidence = cs.evidence.filter((e) => e.source === "interview");

        return (
          <div className="space-y-3">
            <h3 className="text-small font-medium text-ink-2">Evidence ({cs.evidence.length})</h3>

            {sig.scannerCount > 0 && (
              <Banner
                variant="issue"
                action={cs.level === "notEvaluated" ? (
                  <Tooltip text="Ask A11yBot to assess this criterion using the scanner findings">
                    <Button variant="secondary" size="sm" onClick={draftOnly} disabled={drafting}>
                      {drafting ? "Drafting…" : "AI Draft"}
                    </Button>
                  </Tooltip>
                ) : undefined}
              >
                <strong>{sig.scannerCount} accessibility issue{sig.scannerCount !== 1 ? "s" : ""} detected</strong>
                {" — "}scanner evidence suggests this criterion is likely <strong>not fully supported</strong>.
              </Banner>
            )}
            {sig.scannerCount === 0 && sig.interviewCount > 0 && (
              <Banner variant="accent">
                <strong>Interview response provided</strong> — no scanner issues detected for this criterion.
              </Banner>
            )}

            {/* Scanner violations — grouped by rule */}
            {scannerEvidence.length > 0 && (() => {
              const groups = new Map<string, typeof scannerEvidence>();
              for (const e of scannerEvidence) {
                const key = e.rawId ?? e.detail;
                groups.set(key, [...(groups.get(key) ?? []), e]);
              }
              return (
                <div>
                  <p className="eyebrow mb-1.5">
                    Scanner findings ({groups.size} rule{groups.size !== 1 ? "s" : ""}, {scannerEvidence.length} instance{scannerEvidence.length !== 1 ? "s" : ""})
                  </p>
                  <ul className="space-y-1.5">
                    {[...groups.entries()].map(([key, items]) => (
                      <li key={key} className="text-small text-issue-bg bg-issue-bg border border-issue-rule rounded-md px-3 py-2 text-ink-2">
                        <span className="font-medium text-ink-1">{items[0].detail}</span>
                        {items.some((e) => e.ref) && (
                          <ul className="mt-1.5 space-y-0.5">
                            {items.filter((e) => e.ref).map((e, i) => (
                              <li key={i} className="text-ink-4 font-mono text-caption break-all">
                                {items.length > 1 && <span className="text-ink-5 mr-1">↳</span>}{e.ref}
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
                <p className="eyebrow mb-1.5">Interview responses</p>
                <ul className="space-y-1.5">
                  {interviewEvidence.map((e, i) => (
                    <li key={i} className="text-small text-ink-2 bg-accent-soft border border-accent-rule rounded-md px-3 py-2">
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
          <h3 className="text-small font-medium text-ink-2 mb-2">Interview Question</h3>
          <p className="text-small text-ink-2 bg-accent-soft rounded-md px-4 py-3 border border-accent-rule">{criterionDef.interviewQuestion}</p>
          <div className="mt-3 space-y-1.5">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <textarea
                  aria-label="Your answer to the interview question"
                  className="w-full rounded border border-rule px-3 py-2 text-small bg-surface text-ink-1 focus:outline-none focus:ring-2 focus:ring-accent h-20 resize-none"
                  placeholder="Your answer…"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Tooltip text="Save your answer as evidence, then ask A11yBot to draft a conformance assessment">
                  <Button variant="primary" onClick={submitAnswer} disabled={!answer.trim() || saving || drafting}>
                    {drafting ? "Drafting…" : "Answer + AI draft"}
                  </Button>
                </Tooltip>
                <Tooltip text="Mark this criterion as Not Applicable and save immediately">
                  <Button variant="secondary" onClick={async () => {
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
                  }} disabled={saving}>
                    Skip / N/A
                  </Button>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conformance editor */}
      <div className="space-y-4">
        <h3 className="text-small font-medium text-ink-2">Conformance</h3>
        <div>
          <label htmlFor="conformance-level" className="block text-small text-ink-3">
            Level
            <select
              id="conformance-level"
              className="mt-1 block rounded border border-rule px-3 py-2 text-small w-full bg-surface text-ink-1 focus:outline-none focus:ring-2 focus:ring-accent"
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
          <label htmlFor="conformance-remark" className="block text-small text-ink-3">
            Remarks & Explanations
            <textarea
              id="conformance-remark"
              aria-label="Remarks and Explanations"
              className="mt-1 w-full rounded border border-rule px-3 py-2 text-small bg-surface text-ink-1 focus:outline-none focus:ring-2 focus:ring-accent h-28 resize-y"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Vendor remarks…"
            />
          </label>
        </div>

        {error && <div className="text-small text-issue">{error}</div>}

        <div className="flex items-center gap-2 flex-wrap">
          {onConfirmAndNext ? (
            <>
              <Tooltip text="Confirm this assessment and move to the next item to review  [Space]">
                <Button variant="primary" onClick={saveAndNext} disabled={saving}>
                  {saving ? "Saving…" : "Confirm & next →"}
                </Button>
              </Tooltip>
              <Tooltip text="Save without advancing — stay on this criterion">
                <Button variant="secondary" onClick={save} disabled={saving}>
                  {saving ? "…" : "Save only"}
                </Button>
              </Tooltip>
            </>
          ) : (
            <Tooltip text="Save the current level and remarks, marking this criterion as PM-confirmed">
              <Button variant="primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Confirm & save"}
              </Button>
            </Tooltip>
          )}
          <Tooltip text="Ask A11yBot to draft a conformance assessment from all available evidence">
            <Button variant="secondary" onClick={draftOnly} disabled={drafting}>
              {drafting ? "Drafting…" : "AI draft"}
            </Button>
          </Tooltip>
          {cs?.level !== "notEvaluated" && (
            <Tooltip text="Clear the current assessment and return this criterion to unevaluated" className="ml-auto">
              <Button variant="danger" onClick={resetCriterion} disabled={saving}>
                Reset
              </Button>
            </Tooltip>
          )}
        </div>
        {cs?.confidence === "pm-confirmed" && (
          <Banner variant="ok">✓ PM confirmed</Banner>
        )}
      </div>
    </div>
  );
}
