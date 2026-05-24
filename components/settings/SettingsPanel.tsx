"use client";

import { useState, useEffect } from "react";
import { DEFAULT_OPENROUTER_MODEL } from "@/src/ai/models";
import type { OpenRouterModelInfo } from "@/app/api/ai/models/route";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/components/useTheme";
import type { Project } from "@/src/types";

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

type AiProvider = "openrouter" | "ollama" | "none";

interface OllamaStatus { available: boolean; models: string[] }
interface TestResult { status: "idle" | "testing" | "ok" | "error"; message?: string }

interface Props {
  open: boolean;
  onClose: () => void;
  project?: Project | null;
  onProjectUpdate?: (updates: Partial<Project>) => void;
}

export function SettingsPanel({ open, onClose, project, onProjectUpdate }: Props) {
  const { theme, setTheme } = useTheme();
  const [sourcePath, setSourcePath] = useState(project?.sourcePath ?? "");
  const [runtimeUrl, setRuntimeUrl] = useState(project?.runtimeUrl ?? "");
  const [pathsSaved, setPathsSaved] = useState(false);
  const [provider, setProvider] = useState<AiProvider>("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_OPENROUTER_MODEL);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [testResult, setTestResult] = useState<TestResult>({ status: "idle" });
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [openrouterModels, setOpenrouterModels] = useState<OpenRouterModelInfo[]>([]);
  const [modelsSource, setModelsSource] = useState<"live" | "fallback">("fallback");

  useEffect(() => {
    if (!open) return;
    setSourcePath(project?.sourcePath ?? "");
    setRuntimeUrl(project?.runtimeUrl ?? "");
    setPathsSaved(false);
    setTestResult({ status: "idle" });
    setSaveOk(false);

    Promise.all([
      fetch("/api/ai/provider").then((r) => r.ok ? r.json() : null),
      fetch("/api/user-config").then((r) => r.ok ? r.json() : null),
      fetch("/api/ai/models").then((r) => r.ok ? r.json() : null),
    ]).then(([providerData, configData, modelsData]) => {
      if (providerData) {
        setOllamaStatus(providerData.ollama);
        // In-memory provider takes precedence; fall back to persisted config
        const p = providerData.current.provider !== "none"
          ? providerData.current.provider
          : configData?.aiDefaults?.provider ?? "openrouter";
        const m = providerData.current.model || configData?.aiDefaults?.model || DEFAULT_OPENROUTER_MODEL;
        setProvider(p);
        setModel(m);
      }
      if (modelsData) {
        setOpenrouterModels(modelsData.models);
        setModelsSource(modelsData.source);
      }
    }).catch(() => setOllamaStatus({ available: false, models: [] }));
  }, [open]);

  const handleTest = async () => {
    setTestResult({ status: "testing" });
    try {
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: apiKey || undefined, model }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      setTestResult(data.success ? { status: "ok" } : { status: "error", message: data.error });
    } catch (err) {
      setTestResult({ status: "error", message: String(err) });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/ai/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: apiKey || undefined, model }),
      });
      // Persist to ~/.a11ybot/config.json so settings survive restarts
      await fetch("/api/user-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiDefaults: { provider, model, apiKey: apiKey || undefined },
        }),
      });
      setSaveOk(true);
      setTimeout(onClose, 800);
    } catch {
      // leave panel open on error
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-surface shadow-xl z-50 flex flex-col" role="dialog" aria-label="Settings">
        <div className="flex items-center justify-between p-5 border-b border-rule">
          <h2 className="text-heading font-semibold text-ink-1">Settings</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close settings">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" /></svg>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <section>
            <h3 className="text-small font-semibold text-ink-2 mb-3">AI Provider</h3>
            <div className="space-y-2">
              {/* OpenRouter */}
              <SettingsProviderCard selected={provider === "openrouter"} onClick={() => { setProvider("openrouter"); setModel((m) => openrouterModels.some((r) => r.id === m) ? m : DEFAULT_OPENROUTER_MODEL); }}>
                <span className="text-small font-medium text-ink-1">OpenRouter</span>
                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-soft text-accent">Recommended</span>
              </SettingsProviderCard>

              {provider === "openrouter" && (
                <div className="ml-6 space-y-3 pt-1">
                  <div>
                    <label className="block text-caption font-medium text-ink-2 mb-1">API Key</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        aria-label="OpenRouter API Key"
                        className="flex-1 rounded border border-rule px-3 py-2 text-small bg-surface text-ink-1 focus:outline-none focus:ring-2 focus:ring-accent"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-or-v1-… (leave blank to keep existing)"
                      />
                      <Button variant="secondary" type="button" onClick={handleTest} disabled={!model || testResult.status === "testing"}>
                        {testResult.status === "testing" ? "…" : "Test"}
                      </Button>
                    </div>
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-caption text-accent hover:underline mt-1 inline-block">
                      Get a key →
                    </a>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-caption font-medium text-ink-2">Model</label>
                      {modelsSource === "fallback" && (
                        <span className="text-[10px] text-ink-4">default list — save a key to load your models</span>
                      )}
                    </div>
                    <select aria-label="AI Model" className="w-full rounded border border-rule px-3 py-2 text-small bg-surface text-ink-1 focus:outline-none focus:ring-2 focus:ring-accent"
                      value={model} onChange={(e) => setModel(e.target.value)}>
                      {openrouterModels.length === 0 ? (
                        <option value={DEFAULT_OPENROUTER_MODEL}>{DEFAULT_OPENROUTER_MODEL}</option>
                      ) : groupByProvider(openrouterModels).map(([provider, models]) => (
                        <optgroup key={provider} label={provider}>
                          {models.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Ollama */}
              <SettingsProviderCard
                selected={provider === "ollama"}
                disabled={ollamaStatus !== null && !ollamaStatus.available}
                onClick={() => { if (ollamaStatus?.available) { setProvider("ollama"); setModel(ollamaStatus.models[0] ?? ""); } }}
              >
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

              {provider === "ollama" && ollamaStatus?.available && (
                <div className="ml-6 pt-1">
                  <label className="block text-caption font-medium text-ink-2 mb-1">Model</label>
                  <select aria-label="Ollama Model" className="w-full rounded border border-rule px-3 py-2 text-small bg-surface text-ink-1 focus:outline-none focus:ring-2 focus:ring-accent"
                    value={model} onChange={(e) => setModel(e.target.value)}>
                    {ollamaStatus.models.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <p className="mt-2 text-xs text-amber-600">⚠ Local models produce less reliable conformance language.</p>
                </div>
              )}

              {/* None */}
              <SettingsProviderCard selected={provider === "none"} onClick={() => setProvider("none")}>
                <span className="text-small font-medium text-ink-1">None</span>
                <span className="ml-2 text-caption text-ink-4">interview-only</span>
              </SettingsProviderCard>
            </div>

            {testResult.status === "ok" && (
              <div className="mt-3 rounded-md bg-ok-bg border border-ok-rule text-ok text-caption p-2">✓ Connection successful</div>
            )}
            {testResult.status === "error" && (
              <div className="mt-3 rounded-md bg-issue-bg border border-issue-rule text-issue text-caption p-2">{testResult.message}</div>
            )}
          </section>

          {project && (
            <section>
              <h3 className="text-small font-semibold text-ink-2 mb-3">Project — Scan Paths</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-caption font-medium text-ink-2 mb-1">Source path</label>
                  <input
                    type="text"
                    className="w-full rounded border border-rule px-3 py-2 text-small bg-surface text-ink-1 font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="/Users/you/projects/myapp/src"
                    value={sourcePath}
                    onChange={(e) => { setSourcePath(e.target.value); setPathsSaved(false); }}
                  />
                  <p className="mt-1 text-caption text-ink-4">Absolute path scanned for accessibility violations</p>
                </div>
                <div>
                  <label className="block text-caption font-medium text-ink-2 mb-1">App URL</label>
                  <input
                    type="url"
                    className="w-full rounded border border-rule px-3 py-2 text-small bg-surface text-ink-1 font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="https://staging.example.com"
                    value={runtimeUrl}
                    onChange={(e) => { setRuntimeUrl(e.target.value); setPathsSaved(false); }}
                  />
                  <p className="mt-1 text-caption text-ink-4">URL for Lighthouse + axe runtime scan</p>
                </div>
                <Button
                  variant="secondary"
                  disabled={pathsSaved}
                  onClick={async () => {
                    const res = await fetch(`/api/projects/${project!.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ sourcePath: sourcePath || null, runtimeUrl: runtimeUrl || null }),
                    });
                    if (res.ok) {
                      const updated = await res.json() as Project;
                      onProjectUpdate?.({ sourcePath: updated.sourcePath, runtimeUrl: updated.runtimeUrl });
                      setPathsSaved(true);
                    }
                  }}
                >
                  {pathsSaved ? "✓ Saved" : "Save paths"}
                </Button>
              </div>
            </section>
          )}

          <section>
            <h3 className="text-small font-semibold text-ink-2 mb-3">Appearance</h3>
            <div className="flex rounded-md border border-rule overflow-hidden">
              {(["light", "system", "dark"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`flex-1 py-2 text-small capitalize transition-colors ${
                    theme === t
                      ? "bg-accent text-white font-medium"
                      : "text-ink-3 hover:bg-surface-2"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="p-5 border-t border-rule">
          <Button variant="primary" onClick={handleSave} disabled={saving} className="w-full justify-center">
            {saveOk ? "✓ Saved" : saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </>
  );
}

function SettingsProviderCard({ selected, disabled, onClick, children }: { selected: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-3 py-2.5 rounded-lg border-2 transition-colors flex items-center gap-2 ${
        selected ? "border-accent bg-accent-soft" :
        disabled ? "border-rule opacity-50 cursor-not-allowed" :
        "border-rule hover:border-accent-rule"
      }`}
    >
      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "border-blue-500" : "border-ink-4"}`}>
        {selected && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
      </div>
      <div className="flex items-center flex-wrap">{children}</div>
    </button>
  );
}
