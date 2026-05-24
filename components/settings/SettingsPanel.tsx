"use client";

import { useState, useEffect } from "react";
import { OPENROUTER_MODELS, DEFAULT_OPENROUTER_MODEL } from "@/src/ai/models";

type AiProvider = "openrouter" | "ollama" | "none";

interface OllamaStatus { available: boolean; models: string[] }
interface TestResult { status: "idle" | "testing" | "ok" | "error"; message?: string }

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: Props) {
  const [provider, setProvider] = useState<AiProvider>("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_OPENROUTER_MODEL);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [testResult, setTestResult] = useState<TestResult>({ status: "idle" });
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTestResult({ status: "idle" });
    setSaveOk(false);

    Promise.all([
      fetch("/api/ai/provider").then((r) => r.ok ? r.json() : null),
      fetch("/api/user-config").then((r) => r.ok ? r.json() : null),
    ]).then(([providerData, configData]) => {
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
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-xl z-50 flex flex-col" role="dialog" aria-label="Settings">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close settings">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">AI Provider</h3>
            <div className="space-y-2">
              {/* OpenRouter */}
              <SettingsProviderCard selected={provider === "openrouter"} onClick={() => { setProvider("openrouter"); setModel((m) => OPENROUTER_MODELS.some((r) => r.id === m) ? m : DEFAULT_OPENROUTER_MODEL); }}>
                <span className="text-sm font-medium text-gray-900">OpenRouter</span>
                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">Recommended</span>
              </SettingsProviderCard>

              {provider === "openrouter" && (
                <div className="ml-6 space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">API Key</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        aria-label="OpenRouter API Key"
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-or-v1-… (leave blank to keep existing)"
                      />
                      <button
                        type="button"
                        onClick={handleTest}
                        disabled={!model || testResult.status === "testing"}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors whitespace-nowrap"
                      >
                        {testResult.status === "testing" ? "…" : "Test"}
                      </button>
                    </div>
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                      Get a key →
                    </a>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Model</label>
                    <select aria-label="AI Model" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={model} onChange={(e) => setModel(e.target.value)}>
                      <optgroup label="★ Recommended">
                        {OPENROUTER_MODELS.filter((m) => m.tier === "recommended").map((m) => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Other capable models">
                        {OPENROUTER_MODELS.filter((m) => m.tier === "capable").map((m) => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </optgroup>
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
                <span className="text-sm font-medium text-gray-900">Ollama</span>
                <span className="ml-2 text-xs text-gray-400">local · free</span>
                {ollamaStatus === null && <span className="ml-2 text-xs text-gray-400">Detecting…</span>}
                {ollamaStatus?.available && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
                    {ollamaStatus.models.length} model{ollamaStatus.models.length !== 1 ? "s" : ""}
                  </span>
                )}
                {ollamaStatus && !ollamaStatus.available && <span className="ml-2 text-xs text-red-400">Not detected</span>}
              </SettingsProviderCard>

              {provider === "ollama" && ollamaStatus?.available && (
                <div className="ml-6 pt-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Model</label>
                  <select aria-label="Ollama Model" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={model} onChange={(e) => setModel(e.target.value)}>
                    {ollamaStatus.models.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <p className="mt-2 text-xs text-amber-600">⚠ Local models produce less reliable conformance language.</p>
                </div>
              )}

              {/* None */}
              <SettingsProviderCard selected={provider === "none"} onClick={() => setProvider("none")}>
                <span className="text-sm font-medium text-gray-900">None</span>
                <span className="ml-2 text-xs text-gray-400">interview-only</span>
              </SettingsProviderCard>
            </div>

            {testResult.status === "ok" && (
              <div className="mt-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs p-2">✓ Connection successful</div>
            )}
            {testResult.status === "error" && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs p-2">{testResult.message}</div>
            )}
          </section>
        </div>

        <div className="p-5 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2 px-4 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saveOk ? "✓ Saved" : saving ? "Saving…" : "Save"}
          </button>
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
        selected ? "border-blue-500 bg-blue-50" :
        disabled ? "border-gray-100 opacity-50 cursor-not-allowed" :
        "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "border-blue-500" : "border-gray-400"}`}>
        {selected && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
      </div>
      <div className="flex items-center flex-wrap">{children}</div>
    </button>
  );
}
