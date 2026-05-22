"use client";

import { useState, useEffect } from "react";
import type { Project, Edition, InputMode } from "@/src/types";

const APP_VERSION = "0.1.0-beta.1";
const GITHUB_ISSUES_URL = "https://github.com/richsharples/vpat-tool/issues";

interface CriteriaSource {
  name: string;
  abbr?: string;
  url: string;
  editions: string[];
}
interface CriteriaStatus {
  manifest: { criteriaVersion: string; releasedAt: string; notes: string; sources: CriteriaSource[] };
}

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

type FormState = {
  productName: string;
  productVersion: string;
  productDescription: string;
  contactName: string;
  contactEmail: string;
  edition: Edition;
  mode: InputMode;
  sourcePath: string;
  runtimeUrl: string;
  anthropicApiKey: string;
};

type FieldKey = keyof FormState;
type Errors = Partial<Record<FieldKey, string>>;
type Touched = Partial<Record<FieldKey, boolean>>;

function validate(form: FormState): Errors {
  const errors: Errors = {};

  if (!form.productName.trim())
    errors.productName = "Product name is required — it appears on the VPAT cover page.";

  if (!form.productVersion.trim())
    errors.productVersion = "Version is required. Use semver (e.g. 3.4.1) or a release label (e.g. Q2 2025).";

  if (!form.productDescription.trim())
    errors.productDescription = "Add a brief description — it appears in the VPAT header and sets context for AI drafting.";

  if (!form.contactName.trim())
    errors.contactName = "Contact name is required for the VPAT cover page.";

  if (!form.contactEmail.trim())
    errors.contactEmail = "Contact email is required for the VPAT cover page.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail))
    errors.contactEmail = "Enter a valid email address (e.g. jane@company.com).";

  if (form.anthropicApiKey && !/^sk-ant-[A-Za-z0-9_-]{10,}$/.test(form.anthropicApiKey))
    errors.anthropicApiKey = "API keys start with sk-ant- followed by at least 10 characters. Get one at console.anthropic.com → API Keys.";

  if ((form.mode === "source" || form.mode === "hybrid") && !form.sourcePath.trim())
    errors.sourcePath = "Enter the absolute path to your repository root (e.g. /Users/you/projects/myapp).";

  if (form.mode === "runtime" || form.mode === "hybrid") {
    if (!form.runtimeUrl.trim())
      errors.runtimeUrl = "Enter the URL Lighthouse will scan.";
    else if (!/^https?:\/\/.+/.test(form.runtimeUrl))
      errors.runtimeUrl = "Enter a valid URL starting with https:// (e.g. https://app.example.com).";
  }

  return errors;
}

const STEP1_FIELDS: FieldKey[] = ["productName", "productVersion", "productDescription", "contactName", "contactEmail", "anthropicApiKey"];
const STEP2_FIELDS: FieldKey[] = ["sourcePath", "runtimeUrl"];

export function SetupWizard({ onCreated, loading, setLoading, error, setError }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [criteriaStatus, setCriteriaStatus] = useState<CriteriaStatus | null>(null);

  useEffect(() => {
    fetch("/api/criteria-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setCriteriaStatus(d); })
      .catch(() => {});
  }, []);
  const [form, setForm] = useState<FormState>({
    productName: "",
    productVersion: "",
    productDescription: "",
    contactName: "",
    contactEmail: "",
    edition: "508",
    mode: "interview",
    sourcePath: "",
    runtimeUrl: "",
    anthropicApiKey: "",
  });
  const [touched, setTouched] = useState<Touched>({});

  const set = (key: FieldKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const touch = (key: FieldKey) => () =>
    setTouched((prev) => ({ ...prev, [key]: true }));

  const touchAll = (keys: FieldKey[]) =>
    setTouched((prev) => ({ ...prev, ...Object.fromEntries(keys.map((k) => [k, true])) }));

  const errors = validate(form);
  const fieldError = (key: FieldKey): string | undefined => (touched[key] ? errors[key] : undefined);

  const handleContinue = () => {
    touchAll(STEP1_FIELDS);
    const hasErrors = STEP1_FIELDS.some((k) => errors[k]);
    if (!hasErrors) setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    touchAll([...STEP1_FIELDS, ...STEP2_FIELDS]);
    if (Object.keys(errors).length > 0) return;

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
    <div className="min-h-screen flex">
      {/* Left panel — branding + compliance info */}
      <div className="hidden lg:flex lg:w-80 xl:w-96 flex-col bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 p-8 shrink-0">
        <div className="mb-8">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-extrabold text-white">VPAT Tool</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-500/30 border border-blue-400/40 text-blue-200 text-[10px] font-mono font-semibold">
              v{APP_VERSION}
            </span>
          </div>
          <p className="text-blue-200 text-sm leading-relaxed">
            Generate Accessibility Conformance Reports compliant with VPAT 2.5 — guided interview, automated scanning, and AI-assisted drafting.
          </p>
        </div>

        <div className="flex-1">
          <p className="text-blue-300/70 text-[10px] uppercase tracking-widest font-semibold mb-3">Compliance Standards</p>
          {criteriaStatus ? (
            <>
              <p className="text-blue-300 text-[10px] font-mono mb-3">
                Criteria set v{criteriaStatus.manifest.criteriaVersion} · {criteriaStatus.manifest.releasedAt}
              </p>
              <ul className="space-y-3">
                {criteriaStatus.manifest.sources.map((s) => (
                  <li key={s.url} className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 px-1 py-0.5 rounded bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[9px] font-mono font-bold uppercase">
                      {s.abbr ?? s.name.split(" ")[0]}
                    </span>
                    <div className="min-w-0">
                      <p className="text-white text-xs font-medium leading-snug">{s.name}</p>
                      <a href={s.url} target="_blank" rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-[10px] break-all transition-colors">
                        {s.url}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
              {criteriaStatus.manifest.notes && (
                <p className="mt-4 pt-4 border-t border-white/10 text-blue-300/50 text-[10px] leading-relaxed">
                  {criteriaStatus.manifest.notes}
                </p>
              )}
            </>
          ) : (
            <p className="text-blue-300/50 text-xs">Loading…</p>
          )}
        </div>

        <footer className="mt-8 space-y-2">
          <p className="text-blue-300/50 text-[10px]">
            Copyright &copy; {new Date().getFullYear()}{" "}
            <a href="mailto:rich.sharples@gmail.com" className="hover:text-blue-200 underline underline-offset-2 transition-colors">
              Rich Sharples
            </a>
          </p>
          <a href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-400/60 hover:text-blue-300 text-[10px] transition-colors">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Report an issue on GitHub
          </a>
        </footer>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 overflow-y-auto">
        {/* Mobile-only header (left panel is hidden on small screens) */}
        <div className="lg:hidden mb-6 text-center">
          <div className="flex items-baseline justify-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">VPAT Tool</h1>
            <span className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-300 text-gray-500 text-[10px] font-mono">v{APP_VERSION}</span>
          </div>
          <p className="mt-1 text-gray-500 text-sm">Generate a VPAT 2.5 Accessibility Conformance Report</p>
        </div>

        <div className="w-full max-w-xl">
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

                <Field label="Product Name" required error={fieldError("productName")}>
                  <input
                    aria-label="Product Name"
                    className={inputCls(!!fieldError("productName"))}
                    value={form.productName}
                    onChange={set("productName")}
                    onBlur={touch("productName")}
                    placeholder="Acme Platform"
                  />
                </Field>

                <Field label="Version" required error={fieldError("productVersion")}>
                  <input
                    aria-label="Version"
                    className={inputCls(!!fieldError("productVersion"))}
                    value={form.productVersion}
                    onChange={set("productVersion")}
                    onBlur={touch("productVersion")}
                    placeholder="3.4.1"
                  />
                </Field>

                <Field label="Product Description" required error={fieldError("productDescription")}>
                  <textarea
                    aria-label="Product Description"
                    className={inputCls(!!fieldError("productDescription")) + " h-20 resize-none"}
                    value={form.productDescription}
                    onChange={set("productDescription")}
                    onBlur={touch("productDescription")}
                    placeholder="Brief description of the product for the VPAT header"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Contact Name" required error={fieldError("contactName")}>
                    <input
                      aria-label="Contact Name"
                      className={inputCls(!!fieldError("contactName"))}
                      value={form.contactName}
                      onChange={set("contactName")}
                      onBlur={touch("contactName")}
                      placeholder="Jane Smith"
                    />
                  </Field>
                  <Field label="Contact Email" required error={fieldError("contactEmail")}>
                    <input
                      aria-label="Contact Email"
                      className={inputCls(!!fieldError("contactEmail"))}
                      type="email"
                      value={form.contactEmail}
                      onChange={set("contactEmail")}
                      onBlur={touch("contactEmail")}
                      placeholder="jane@example.com"
                    />
                  </Field>
                </div>

                <Field
                  label="Anthropic API Key"
                  hint="Required for AI drafting. Leave blank to use interview-only mode without AI."
                  error={fieldError("anthropicApiKey")}
                >
                  <input
                    aria-label="Anthropic API Key"
                    className={inputCls(!!fieldError("anthropicApiKey"))}
                    type="password"
                    value={form.anthropicApiKey}
                    onChange={set("anthropicApiKey")}
                    onBlur={touch("anthropicApiKey")}
                    placeholder="sk-ant-…"
                  />
                </Field>

                <div className="pt-2">
                  <button type="button" onClick={handleContinue} className={btnPrimary} title="Continue to edition and input mode settings">
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
                  <Field
                    label="Source Path"
                    hint="Absolute path to the repository root on this machine."
                    error={fieldError("sourcePath")}
                  >
                    <input
                      aria-label="Source Path"
                      className={inputCls(!!fieldError("sourcePath"))}
                      value={form.sourcePath}
                      onChange={set("sourcePath")}
                      onBlur={touch("sourcePath")}
                      placeholder="/Users/you/projects/myapp"
                    />
                  </Field>
                )}

                {(form.mode === "runtime" || form.mode === "hybrid") && (
                  <Field
                    label="Runtime URL"
                    hint="Lighthouse will scan this URL — it must be reachable from this machine."
                    error={fieldError("runtimeUrl")}
                  >
                    <input
                      aria-label="Runtime URL"
                      className={inputCls(!!fieldError("runtimeUrl"))}
                      type="url"
                      value={form.runtimeUrl}
                      onChange={set("runtimeUrl")}
                      onBlur={touch("runtimeUrl")}
                      placeholder="https://app.example.com"
                    />
                  </Field>
                )}

                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{error}</div>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setStep(1)} className={btnSecondary} title="Go back to product and contact details">← Back</button>
                  <button type="submit" disabled={loading} className={btnPrimary} title="Create the project and open the criteria review">
                    {loading ? "Creating project…" : "Create Project →"}
                  </button>
                </div>
              </div>
            )}
          </form>
          </div>
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

function Field({ label, required, hint, error, children }: { label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="block text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
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

const inputCls = (hasError = false) =>
  `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent ${
    hasError ? "border-red-400 focus:ring-red-400 bg-red-50" : "border-gray-300 focus:ring-blue-500"
  }`;

const btnPrimary = "flex-1 py-2 px-4 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btnSecondary = "py-2 px-4 rounded-lg bg-gray-100 text-gray-700 font-medium text-sm hover:bg-gray-200 transition-colors";
