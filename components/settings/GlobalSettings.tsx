"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { TopBanner } from "@/components/TopBanner";
import { useTheme } from "@/components/useTheme";
import { DEFAULT_OPENROUTER_MODEL } from "@/src/ai/models";
import type { OpenRouterModelInfo } from "@/app/api/ai/models/route";

type AiProvider = "openrouter" | "ollama" | "none";
interface OllamaStatus { available: boolean; models: string[] }
interface TestResult { status: "idle" | "testing" | "ok" | "error"; message?: string }

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

/**
 * Global settings — full-screen overlay reachable from the TopBanner on any
 * screen. Covers company/contact identity, AI provider, and appearance, all of
 * which are global (persisted to ~/.a11ybot/config.json), not per-project.
 */
export function GlobalSettings({ onClose }: { onClose: () => void }) {
  const { theme, setTheme } = useTheme();

  // Company & contact
  const [companyName, setCompanyName] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactSaved, setContactSaved] = useState(false);

  // AI
  const [aiProvider, setAiProvider] = useState<AiProvider>("openrouter");
  const [aiKey, setAiKey] = useState("");
  const [aiModel, setAiModel] = useState(DEFAULT_OPENROUTER_MODEL);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [openrouterModels, setOpenrouterModels] = useState<OpenRouterModelInfo[]>([]);
  const [modelsSource, setModelsSource] = useState<"live" | "fallback">("fallback");
  const [testResult, setTestResult] = useState<TestResult>({ status: "idle" });
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);

  const fetchModels = useCallback((key?: string) => {
    const url = key ? `/api/ai/models?key=${encodeURIComponent(key)}` : "/api/ai/models";
    fetch(url).then((r) => r.ok ? r.json() : null).then((d) => {
      if (!d) return;
      setOpenrouterModels(d.models);
      setModelsSource(d.source);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/user-config").then((r) => r.ok ? r.json() : null),
      fetch("/api/ai/provider").then((r) => r.ok ? r.json() : null),
    ]).then(([cfg, providerData]) => {
      if (cfg?.contact) {
        setContactName(cfg.contact.name ?? "");
        setContactEmail(cfg.contact.email ?? "");
      }
      if (cfg?.company) {
        setCompanyName(cfg.company.name ?? "");
        setCompanyUrl(cfg.company.url ?? "");
      }
      if (providerData) {
        setOllamaStatus(providerData.ollama);
        const p = providerData.current.provider !== "none"
          ? providerData.current.provider
          : cfg?.aiDefaults?.provider ?? "openrouter";
        const m = providerData.current.model || cfg?.aiDefaults?.model || DEFAULT_OPENROUTER_MODEL;
        setAiProvider(p);
        setAiModel(m);
      }
    }).catch(() => {});
    fetchModels();
  }, [fetchModels]);

  const handleSaveContact = async () => {
    await fetch("/api/user-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: { name: companyName, url: companyUrl },
        contact: { name: contactName, email: contactEmail },
      }),
    });
    setContactSaved(true);
  };

  const handleTestAi = async () => {
    setTestResult({ status: "testing" });
    try {
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: aiProvider, apiKey: aiKey || undefined, model: aiModel }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      setTestResult(data.success ? { status: "ok" } : { status: "error", message: data.error });
    } catch (err) {
      setTestResult({ status: "error", message: String(err) });
    }
  };

  const handleSaveAi = async () => {
    setAiSaving(true);
    try {
      await fetch("/api/ai/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: aiProvider, apiKey: aiKey || undefined, model: aiModel }),
      });
      await fetch("/api/user-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiDefaults: { provider: aiProvider, model: aiModel, apiKey: aiKey || undefined } }),
      });
      setAiSaved(true);
      setTimeout(() => setAiSaved(false), 2000);
    } finally {
      setAiSaving(false);
    }
  };

  const inputCls = "w-full rounded border border-rule px-3 py-2 text-small bg-surface text-ink-1 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent";

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <TopBanner />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-8 py-10 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-ink-1">Settings</h2>
            <Button variant="ghost" onClick={onClose} className="text-ink-3 hover:text-ink-1">
              <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Button>
          </div>

          {/* Company & contact */}
          <section className="space-y-4">
            <div>
              <h3 className="text-heading font-semibold text-ink-1">Company &amp; Contact</h3>
              <p className="text-caption text-ink-3 mt-0.5">Used on the VPAT report and pre-filled on every new project.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-small font-medium text-ink-2">Company name</label>
                <input className={inputCls} value={companyName}
                  onChange={(e) => { setCompanyName(e.target.value); setContactSaved(false); }}
                  placeholder="Acme Corporation" />
              </div>
              <div className="space-y-1">
                <label className="block text-small font-medium text-ink-2">Company website</label>
                <input className={inputCls} type="url" value={companyUrl}
                  onChange={(e) => { setCompanyUrl(e.target.value); setContactSaved(false); }}
                  placeholder="https://acme.com" />
              </div>
              <div className="space-y-1">
                <label className="block text-small font-medium text-ink-2">Contact name</label>
                <input className={inputCls} value={contactName}
                  onChange={(e) => { setContactName(e.target.value); setContactSaved(false); }}
                  placeholder="Jane Smith" />
              </div>
              <div className="space-y-1">
                <label className="block text-small font-medium text-ink-2">Contact email</label>
                <input className={inputCls} type="email" value={contactEmail}
                  onChange={(e) => { setContactEmail(e.target.value); setContactSaved(false); }}
                  placeholder="jane@example.com" />
              </div>
            </div>
            <Button variant="secondary" onClick={handleSaveContact} disabled={contactSaved}>
              {contactSaved ? "✓ Saved" : "Save details"}
            </Button>
          </section>

          <hr className="border-rule" />

          {/* AI Provider */}
          <section className="space-y-4">
            <div>
              <h3 className="text-heading font-semibold text-ink-1">AI Provider</h3>
              <p className="text-caption text-ink-3 mt-0.5">Used to draft conformance language across all projects.</p>
            </div>

            <div className="space-y-2">
              {/* OpenRouter */}
              <SettingsProviderCard selected={aiProvider === "openrouter"}
                onClick={() => { setAiProvider("openrouter"); setAiModel((m) => openrouterModels.some((r) => r.id === m) ? m : DEFAULT_OPENROUTER_MODEL); setAiSaved(false); }}>
                <span className="text-small font-medium text-ink-1">OpenRouter</span>
                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-soft text-accent">Recommended</span>
              </SettingsProviderCard>

              {aiProvider === "openrouter" && (
                <div className="ml-6 space-y-3 pt-1">
                  <div className="space-y-1">
                    <label className="block text-caption font-medium text-ink-2">API Key</label>
                    <div className="flex gap-2">
                      <input type="password" aria-label="OpenRouter API Key"
                        className={inputCls + " flex-1"}
                        value={aiKey}
                        onChange={(e) => { setAiKey(e.target.value); setAiSaved(false); }}
                        onBlur={(e) => { if (e.target.value.startsWith("sk-or-")) fetchModels(e.target.value); }}
                        placeholder="sk-or-v1-… (leave blank to keep existing)" />
                      <Button variant="secondary" type="button" onClick={handleTestAi}
                        disabled={!aiModel || testResult.status === "testing"}>
                        {testResult.status === "testing" ? "…" : "Test"}
                      </Button>
                    </div>
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
                      className="text-caption text-accent hover:underline mt-1 inline-block">Get a key →</a>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-caption font-medium text-ink-2">Model</label>
                      {modelsSource === "fallback" && (
                        <span className="text-[10px] text-ink-4">default list — save a key to load your models</span>
                      )}
                    </div>
                    <select aria-label="AI Model" className={inputCls}
                      value={aiModel} onChange={(e) => { setAiModel(e.target.value); setAiSaved(false); }}>
                      {openrouterModels.length === 0 ? (
                        <option value={DEFAULT_OPENROUTER_MODEL}>{DEFAULT_OPENROUTER_MODEL}</option>
                      ) : groupByProvider(openrouterModels).map(([prov, models]) => (
                        <optgroup key={prov} label={prov}>
                          {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Ollama */}
              <SettingsProviderCard
                selected={aiProvider === "ollama"}
                disabled={ollamaStatus !== null && !ollamaStatus.available}
                onClick={() => { if (ollamaStatus?.available) { setAiProvider("ollama"); setAiModel(ollamaStatus.models[0] ?? ""); setAiSaved(false); } }}>
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

              {aiProvider === "ollama" && ollamaStatus?.available && (
                <div className="ml-6 pt-1 space-y-2">
                  <div className="space-y-1">
                    <label className="block text-caption font-medium text-ink-2">Model</label>
                    <select aria-label="Ollama Model" className={inputCls}
                      value={aiModel} onChange={(e) => { setAiModel(e.target.value); setAiSaved(false); }}>
                      {ollamaStatus.models.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <p className="text-xs text-amber-600">⚠ Local models produce less reliable conformance language.</p>
                </div>
              )}

              {/* None */}
              <SettingsProviderCard selected={aiProvider === "none"}
                onClick={() => { setAiProvider("none"); setAiSaved(false); }}>
                <span className="text-small font-medium text-ink-1">None</span>
                <span className="ml-2 text-caption text-ink-4">interview-only mode</span>
              </SettingsProviderCard>
            </div>

            {testResult.status === "ok" && (
              <div className="rounded-md bg-ok-bg border border-ok-rule text-ok text-caption p-2">✓ Connection successful</div>
            )}
            {testResult.status === "error" && (
              <div className="rounded-md bg-issue-bg border border-issue-rule text-issue text-caption p-2">{testResult.message}</div>
            )}

            <Button variant="secondary" onClick={handleSaveAi} disabled={aiSaving || aiSaved}>
              {aiSaved ? "✓ Saved" : aiSaving ? "Saving…" : "Save AI settings"}
            </Button>
          </section>

          <hr className="border-rule" />

          {/* Appearance */}
          <section className="space-y-4">
            <div>
              <h3 className="text-heading font-semibold text-ink-1">Appearance</h3>
              <p className="text-caption text-ink-3 mt-0.5">Applies across all sessions on this machine.</p>
            </div>
            <div className="flex rounded-md border border-rule overflow-hidden">
              {(["light", "system", "dark"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTheme(t)}
                  className={`flex-1 py-2 text-small capitalize transition-colors ${
                    theme === t ? "bg-accent text-white font-medium" : "text-ink-3 hover:bg-surface-2"
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function SettingsProviderCard({ selected, disabled, onClick, children }: { selected: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`w-full text-left px-3 py-2.5 rounded-lg border-2 transition-colors flex items-center gap-2 ${
        selected ? "border-accent bg-accent-soft" :
        disabled ? "border-rule opacity-50 cursor-not-allowed" :
        "border-rule hover:border-accent-rule"
      }`}>
      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "border-blue-500" : "border-ink-4"}`}>
        {selected && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
      </div>
      <div className="flex items-center flex-wrap">{children}</div>
    </button>
  );
}
