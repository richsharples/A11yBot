"use client";

import { useState } from "react";
import type { Project, Edition, InputMode } from "@/src/types";

interface Props {
  onCreated: (project: Project) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  error: string | null;
  setError: (v: string | null) => void;
}

const EDITIONS: { value: Edition; label: string; description: string }[] = [
  { value: "508", label: "Section 508", description: "US federal procurement (WCAG 2.0 + 508 chapters)" },
  { value: "INT", label: "International (INT)", description: "Combined 508 + EN 301 549 + WCAG 2.1/2.2" },
];

const MODES: { value: InputMode; label: string; description: string }[] = [
  { value: "interview", label: "Interview only", description: "Guided Q&A — no scanner needed" },
  { value: "source", label: "Source scan", description: "Point at a local code repository" },
  { value: "runtime", label: "Runtime scan", description: "Point at a live URL (uses Lighthouse)" },
  { value: "hybrid", label: "Hybrid (recommended)", description: "Source + runtime + interview" },
];

export function SetupWizard({ onCreated, loading, setLoading, error, setError }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    productName: "",
    productVersion: "",
    productDescription: "",
    contactName: "",
    contactEmail: "",
    edition: "508" as Edition,
    mode: "interview" as InputMode,
    sourcePath: "",
    runtimeUrl: "",
    anthropicApiKey: "",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, string> = {
        productName: form.productName,
        productVersion: form.productVersion,
        productDescription: form.productDescription,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        edition: form.edition,
        mode: form.mode,
      };
      if (form.sourcePath) payload.sourcePath = form.sourcePath;
      if (form.runtimeUrl) payload.runtimeUrl = form.runtimeUrl;
      if (form.anthropicApiKey) payload.anthropicApiKey = form.anthropicApiKey;

      const res = await fetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create project");
      }
      const project = await res.json() as Project;
      onCreated(project);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">VPAT Tool</h1>
          <p className="mt-2 text-gray-600">Generate a VPAT 2.5 Accessibility Conformance Report</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <StepDot n={1} active={step === 1} done={step === 2} />
            <div className="flex-1 h-px bg-gray-200" />
            <StepDot n={2} active={step === 2} done={false} />
          </div>

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="space-y-5">
                <h2 className="text-lg font-semibold text-gray-900">Product & Contact</h2>

                <Field label="Product Name" required>
                  <input className={inputCls} value={form.productName} onChange={set("productName")} placeholder="Acme Platform" required />
                </Field>
                <Field label="Version" required>
                  <input className={inputCls} value={form.productVersion} onChange={set("productVersion")} placeholder="3.4.1" required />
                </Field>
                <Field label="Product Description" required>
                  <textarea className={inputCls + " h-20 resize-none"} value={form.productDescription} onChange={set("productDescription")} placeholder="Brief description of the product for the VPAT header" required />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Contact Name" required>
                    <input className={inputCls} value={form.contactName} onChange={set("contactName")} placeholder="Jane Smith" required />
                  </Field>
                  <Field label="Contact Email" required>
                    <input className={inputCls} type="email" value={form.contactEmail} onChange={set("contactEmail")} placeholder="jane@example.com" required />
                  </Field>
                </div>
                <Field label="Anthropic API Key" hint="Required for AI drafting. Leave blank for interview-only without AI.">
                  <input className={inputCls} type="password" value={form.anthropicApiKey} onChange={set("anthropicApiKey")} placeholder="sk-ant-..." />
                </Field>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!form.productName || !form.productVersion || !form.productDescription || !form.contactName || !form.contactEmail}
                    className={btnPrimary}
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <h2 className="text-lg font-semibold text-gray-900">Edition & Input Mode</h2>

                <Field label="VPAT Edition">
                  <div className="grid grid-cols-2 gap-3">
                    {EDITIONS.map((e) => (
                      <RadioCard key={e.value} selected={form.edition === e.value} onClick={() => setForm((p) => ({ ...p, edition: e.value }))}>
                        <div className="font-medium text-sm">{e.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{e.description}</div>
                      </RadioCard>
                    ))}
                  </div>
                </Field>

                <Field label="Input Mode">
                  <div className="grid grid-cols-2 gap-3">
                    {MODES.map((m) => (
                      <RadioCard key={m.value} selected={form.mode === m.value} onClick={() => setForm((p) => ({ ...p, mode: m.value }))}>
                        <div className="font-medium text-sm">{m.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{m.description}</div>
                      </RadioCard>
                    ))}
                  </div>
                </Field>

                {(form.mode === "source" || form.mode === "hybrid") && (
                  <Field label="Source Path" hint="Absolute path to the repository root">
                    <input className={inputCls} value={form.sourcePath} onChange={set("sourcePath")} placeholder="/Users/you/projects/myapp" />
                  </Field>
                )}

                {(form.mode === "runtime" || form.mode === "hybrid") && (
                  <Field label="Runtime URL" hint="The URL Lighthouse will scan">
                    <input className={inputCls} type="url" value={form.runtimeUrl} onChange={set("runtimeUrl")} placeholder="https://app.example.com" />
                  </Field>
                )}

                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{error}</div>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setStep(1)} className={btnSecondary}>← Back</button>
                  <button type="submit" disabled={loading} className={btnPrimary}>
                    {loading ? "Creating project…" : "Create Project →"}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${active ? "bg-blue-600 text-white" : done ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600"}`}>
      {done ? "✓" : n}
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      {children}
    </div>
  );
}

function RadioCard({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-3 rounded-lg border-2 transition-colors ${selected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
    >
      {children}
    </button>
  );
}

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const btnPrimary = "flex-1 py-2 px-4 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btnSecondary = "py-2 px-4 rounded-lg bg-gray-100 text-gray-700 font-medium text-sm hover:bg-gray-200 transition-colors";
