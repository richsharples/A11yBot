"use client";

import { useState, useEffect } from "react";
import type { Project, Edition, InputMode, ProductComponent, UserConfig } from "@/src/types";
import { OPENROUTER_MODELS, DEFAULT_OPENROUTER_MODEL } from "@/src/ai/models";

const APP_VERSION = "0.1.0-beta.4";
const GITHUB_ISSUES_URL = "https://github.com/richsharples/a11ybot/issues";

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

const COMPONENTS: { value: ProductComponent; label: string; description: string; icon: string }[] = [
  { value: "web",      label: "SaaS / Web",            description: "Web application, website, or web content",    icon: "🌐" },
  { value: "software", label: "Desktop / Mobile App",  description: "Native app, Electron, iOS, Android",          icon: "💻" },
  { value: "hardware", label: "Hardware",              description: "Physical device with a user interface",        icon: "🖥️" },
  { value: "docs",     label: "Documentation",         description: "User manuals, in-product help, release notes", icon: "📄" },
  { value: "support",  label: "Support Services",      description: "Help desk, live chat, support portal",         icon: "🎧" },
];

const MODES: { value: InputMode; label: string; description: string }[] = [
  { value: "interview", label: "Interview only",         description: "Guided Q&A — no scanner needed" },
  { value: "source",    label: "Source scan",            description: "Point at a local code repository" },
  { value: "runtime",   label: "Runtime scan",           description: "Point at a live URL (uses Lighthouse)" },
  { value: "hybrid",    label: "Hybrid (recommended)",   description: "Source + runtime + interview" },
];

type AiProvider = "openrouter" | "ollama" | "none";

type FormState = {
  productName: string;
  productVersion: string;
  productDescription: string;
  contactName: string;
  contactEmail: string;
  edition: Edition;
  mode: InputMode;
  productComponents: ProductComponent[];
  sourcePath: string;
  runtimeUrl: string;
  aiProvider: AiProvider;
  aiApiKey: string;
  aiModel: string;
};

type FieldKey = keyof FormState;
type Errors = Partial<Record<FieldKey, string>>;
type Touched = Partial<Record<FieldKey, boolean>>;

function validate(form: FormState): Errors {
  const errors: Errors = {};

  if (form.productComponents.length === 0)
    errors.productComponents = "Select at least one component type — this determines which criteria apply.";
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
  if ((form.mode === "source" || form.mode === "hybrid") && !form.sourcePath.trim())
    errors.sourcePath = "Enter the absolute path to your repository root (e.g. /Users/you/projects/myapp).";
  if (form.mode === "runtime" || form.mode === "hybrid") {
    if (!form.runtimeUrl.trim())
      errors.runtimeUrl = "Enter the URL Lighthouse will scan.";
    else if (!/^https?:\/\/.+/.test(form.runtimeUrl))
      errors.runtimeUrl = "Enter a valid URL starting with https:// (e.g. https://app.example.com).";
  }
  if (form.aiProvider === "openrouter" && form.aiApiKey && !form.aiApiKey.startsWith("sk-or-"))
    errors.aiApiKey = "OpenRouter keys start with sk-or-. Get one at openrouter.ai/keys.";

  return errors;
}

const STEP1_FIELDS: FieldKey[] = ["productName", "productVersion", "productDescription", "contactName", "contactEmail"];
const STEP2_FIELDS: FieldKey[] = ["productComponents", "edition", "mode"];
const STEP3_FIELDS: FieldKey[] = ["sourcePath", "runtimeUrl"];
const STEP4_FIELDS: FieldKey[] = ["aiApiKey"];

interface OllamaStatus { available: boolean; models: string[] }
interface TestResult { status: "idle" | "testing" | "ok" | "error"; message?: string }

export function SetupWizard({ onCreated, loading, setLoading, error, setError }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [criteriaStatus, setCriteriaStatus] = useState<CriteriaStatus | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [testResult, setTestResult] = useState<TestResult>({ status: "idle" });
  const [userConfig, setUserConfig] = useState<UserConfig | null>(null);

  useEffect(() => {
    fetch("/api/criteria-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setCriteriaStatus(d); })
      .catch(() => {});
    fetch("/api/user-config")
      .then((r) => r.ok ? r.json() : null)
      .then((cfg: UserConfig | null) => {
        if (!cfg) return;
        setUserConfig(cfg);
        // Pre-fill contact and AI defaults
        setForm((prev) => ({
          ...prev,
          contactName: cfg.contact?.name || prev.contactName,
          contactEmail: cfg.contact?.email || prev.contactEmail,
          aiProvider: (cfg.aiDefaults?.provider !== "none" ? cfg.aiDefaults?.provider : prev.aiProvider) ?? prev.aiProvider,
          aiModel: cfg.aiDefaults?.model || prev.aiModel,
        }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (step !== 4) return;
    setOllamaStatus(null);
    fetch("/api/ai/provider")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setOllamaStatus(d.ollama); })
      .catch(() => setOllamaStatus({ available: false, models: [] }));
  }, [step]);

  const [form, setForm] = useState<FormState>({
    productName: "",
    productVersion: "",
    productDescription: "",
    contactName: "",
    contactEmail: "",
    edition: "508",
    mode: "interview",
    productComponents: ["web"],
    sourcePath: "",
    runtimeUrl: "",
    aiProvider: "openrouter",
    aiApiKey: "",
    aiModel: DEFAULT_OPENROUTER_MODEL,
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

  const toggleComponent = (c: ProductComponent) => {
    setForm((prev) => {
      const has = prev.productComponents.includes(c);
      return { ...prev, productComponents: has ? prev.productComponents.filter((x) => x !== c) : [...prev.productComponents, c] };
    });
    setTouched((prev) => ({ ...prev, productComponents: true }));
  };

  const handleContinue = () => {
    touchAll(STEP1_FIELDS);
    if (!STEP1_FIELDS.some((k) => errors[k])) setStep(2);
  };

  const handleContinue2 = () => {
    touchAll(STEP2_FIELDS);
    if (!STEP2_FIELDS.some((k) => errors[k])) setStep(3);
  };

  const handleContinue3 = () => {
    touchAll(STEP3_FIELDS);
    if (!STEP3_FIELDS.some((k) => errors[k])) setStep(4);
  };

  const handleTest = async () => {
    setTestResult({ status: "testing" });
    try {
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: form.aiProvider, apiKey: form.aiApiKey, model: form.aiModel }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      setTestResult(data.success ? { status: "ok" } : { status: "error", message: data.error });
    } catch (err) {
      setTestResult({ status: "error", message: String(err) });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    touchAll([...STEP1_FIELDS, ...STEP2_FIELDS, ...STEP3_FIELDS, ...STEP4_FIELDS]);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        productName: form.productName,
        productVersion: form.productVersion,
        productDescription: form.productDescription,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        edition: form.edition,
        mode: form.mode,
        productComponents: form.productComponents,
      };
      if (form.sourcePath) payload.sourcePath = form.sourcePath;
      if (form.runtimeUrl) payload.runtimeUrl = form.runtimeUrl;
      if (form.aiProvider !== "none") {
        payload.providerConfig = {
          provider: form.aiProvider,
          apiKey: form.aiApiKey || undefined,
          model: form.aiModel,
        };
      }

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

      // Persist contact info so it pre-fills on the next session
      fetch("/api/user-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: { name: form.contactName, email: form.contactEmail } }),
      }).catch(() => {});

      onCreated(project);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — phosphor green terminal theme */}
      <div className="hidden lg:flex lg:w-80 xl:w-96 flex-col h-screen sticky top-0 bg-[#0b1a0d] p-8 shrink-0 border-r border-[#39FF14]/10">
        {/* Logo */}
        <div className="mb-6 -mx-2">
          <img src="/a11ybot-logo.png" alt="A11yBot" className="w-full rounded-lg opacity-95" />
        </div>

        <div className="mb-6">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-extrabold text-[#39FF14] font-mono tracking-tight" style={{ textShadow: "0 0 12px #39FF14aa" }}>
              A11yBot
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] text-[10px] font-mono font-semibold">
              v{APP_VERSION}
            </span>
          </div>
          <p className="text-[#39FF14]/60 text-sm leading-relaxed font-mono">
            Generate VPAT 2.5 Accessibility Conformance Reports — interview, scanning, and AI-assisted drafting.
          </p>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <p className="text-[#39FF14]/40 text-[10px] uppercase tracking-widest font-mono font-semibold mb-3 shrink-0">Compliance Standards</p>
          <div className="flex-1 overflow-y-auto rounded-lg border border-[#39FF14]/10 bg-[#39FF14]/5 p-3 scrollbar-thin" style={{ scrollbarColor: "#39FF14aa transparent" }}>
            {criteriaStatus ? (
              <>
                <p className="text-[#39FF14]/50 text-[10px] font-mono mb-3">
                  Criteria set v{criteriaStatus.manifest.criteriaVersion} · {criteriaStatus.manifest.releasedAt}
                </p>
                <ul className="space-y-3">
                  {criteriaStatus.manifest.sources.map((s) => (
                    <li key={s.url} className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 px-1 py-0.5 rounded bg-[#39FF14]/10 border border-[#39FF14]/20 text-[#39FF14]/80 text-[9px] font-mono font-bold uppercase">
                        {s.abbr ?? s.name.split(" ")[0]}
                      </span>
                      <div className="min-w-0">
                        <a href={s.url} target="_blank" rel="noopener noreferrer"
                          className="text-[#39FF14]/80 hover:text-[#39FF14] text-xs font-mono leading-snug underline underline-offset-2 decoration-[#39FF14]/30 hover:decoration-[#39FF14]/60 transition-colors">
                          {s.name}
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
                {criteriaStatus.manifest.notes && (
                  <p className="mt-4 pt-4 border-t border-[#39FF14]/10 text-[#39FF14]/30 text-[10px] leading-relaxed font-mono">
                    {criteriaStatus.manifest.notes}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[#39FF14]/30 text-xs font-mono">Loading…</p>
            )}
          </div>
        </div>

        <footer className="mt-8 space-y-2">
          <p className="text-[#39FF14]/30 text-[10px] font-mono">
            &copy; {new Date().getFullYear()}{" "}
            <a href="mailto:rich.sharples@gmail.com" className="hover:text-[#39FF14]/60 underline underline-offset-2 transition-colors">
              Rich Sharples
            </a>
          </p>
          <a href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[#39FF14]/30 hover:text-[#39FF14]/60 text-[10px] font-mono transition-colors">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Report an issue on GitHub
          </a>
        </footer>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 overflow-y-auto">
        <div className="lg:hidden mb-6 text-center">
          <div className="flex items-baseline justify-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">A11yBot</h1>
            <span className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-300 text-gray-500 text-[10px] font-mono">v{APP_VERSION}</span>
          </div>
          <p className="mt-1 text-gray-500 text-sm">Generate a VPAT 2.5 Accessibility Conformance Report</p>
        </div>

        <div className="w-full max-w-xl">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            {/* Step indicator */}
            <div className="flex items-center gap-3 mb-6">
              <StepDot n={1} active={step === 1} done={step > 1} />
              <div className="flex-1 h-px bg-gray-200" />
              <StepDot n={2} active={step === 2} done={step > 2} />
              <div className="flex-1 h-px bg-gray-200" />
              <StepDot n={3} active={step === 3} done={step > 3} />
              <div className="flex-1 h-px bg-gray-200" />
              <StepDot n={4} active={step === 4} done={false} />
            </div>

            <form onSubmit={handleSubmit}>
              {/* ── Step 1: Product & Contact ── */}
              {step === 1 && (
                <div className="space-y-5">
                  <h2 className="text-lg font-semibold text-gray-900">Product & Contact</h2>

                  {/* Saved product quick-select */}
                  {userConfig && userConfig.products.length > 0 && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <p className="text-xs font-medium text-blue-700 mb-2">Load saved product</p>
                      <div className="flex gap-2 flex-wrap">
                        {userConfig.products.map((p, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setForm((prev) => ({
                              ...prev,
                              productName: p.name,
                              productVersion: p.version || "",
                              productDescription: p.description || "",
                              productComponents: p.components.length ? p.components : prev.productComponents,
                              edition: p.edition || prev.edition,
                              mode: p.mode || prev.mode,
                              sourcePath: p.sourcePath || "",
                              runtimeUrl: p.runtimeUrl || "",
                            }))}
                            className="px-3 py-1.5 rounded-md bg-white border border-blue-300 text-sm text-blue-700 hover:bg-blue-100 transition-colors font-medium"
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <Field label="Product Name" required error={fieldError("productName")}>
                    <input aria-label="Product Name" className={inputCls(!!fieldError("productName"))}
                      value={form.productName} onChange={set("productName")} onBlur={touch("productName")} placeholder="Acme Platform" />
                  </Field>

                  <Field label="Version" required error={fieldError("productVersion")}>
                    <input aria-label="Version" className={inputCls(!!fieldError("productVersion"))}
                      value={form.productVersion} onChange={set("productVersion")} onBlur={touch("productVersion")} placeholder="3.4.1" />
                  </Field>

                  <Field label="Product Description" required error={fieldError("productDescription")}>
                    <textarea aria-label="Product Description" className={inputCls(!!fieldError("productDescription")) + " h-20 resize-none"}
                      value={form.productDescription} onChange={set("productDescription")} onBlur={touch("productDescription")}
                      placeholder="Brief description of the product for the VPAT header" />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Contact Name" required error={fieldError("contactName")}>
                      <input aria-label="Contact Name" className={inputCls(!!fieldError("contactName"))}
                        value={form.contactName} onChange={set("contactName")} onBlur={touch("contactName")} placeholder="Jane Smith" />
                    </Field>
                    <Field label="Contact Email" required error={fieldError("contactEmail")}>
                      <input aria-label="Contact Email" className={inputCls(!!fieldError("contactEmail"))} type="email"
                        value={form.contactEmail} onChange={set("contactEmail")} onBlur={touch("contactEmail")} placeholder="jane@example.com" />
                    </Field>
                  </div>

                  <div className="pt-2">
                    <button type="button" onClick={handleContinue} className={btnPrimary}>Continue →</button>
                  </div>
                </div>
              )}

              {/* ── Step 2: Product Scope ── */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Product Scope</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Select every component type your product includes. Criteria that don&apos;t apply will be pre-marked <span className="font-medium text-gray-600">N/A</span>.
                    </p>
                  </div>

                  <Field label="What does your product include?" error={fieldError("productComponents")}>
                    <div className="grid grid-cols-1 gap-2 mt-1">
                      {COMPONENTS.map((c) => {
                        const checked = form.productComponents.includes(c.value);
                        return (
                          <button key={c.value} type="button" onClick={() => toggleComponent(c.value)}
                            className={`flex items-start gap-3 text-left p-3 rounded-lg border-2 transition-colors ${checked ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                            <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${checked ? "border-blue-500 bg-blue-500" : "border-gray-400"}`}>
                              {checked && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-900">{c.icon} {c.label}</span>
                              <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  {form.productComponents.length > 0 && (
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
                      <span className="font-semibold">In scope:</span>{" "}
                      {COMPONENTS.filter((c) => form.productComponents.includes(c.value)).map((c) => c.label).join(", ")}.
                      {" "}Unselected component types will be pre-marked N/A.
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setStep(1)} className={btnSecondary}>← Back</button>
                    <button type="button" onClick={handleContinue2} className={btnPrimary}>Continue →</button>
                  </div>
                </div>
              )}

              {/* ── Step 3: Edition & Input Mode ── */}
              {step === 3 && (
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
                    <Field label="Source Path" hint="Absolute path to the repository root on this machine." error={fieldError("sourcePath")}>
                      <input aria-label="Source Path" className={inputCls(!!fieldError("sourcePath"))}
                        value={form.sourcePath} onChange={set("sourcePath")} onBlur={touch("sourcePath")} placeholder="/Users/you/projects/myapp" />
                    </Field>
                  )}

                  {(form.mode === "runtime" || form.mode === "hybrid") && (
                    <Field label="Runtime URL" hint="Lighthouse will scan this URL — it must be reachable from this machine." error={fieldError("runtimeUrl")}>
                      <input aria-label="Runtime URL" className={inputCls(!!fieldError("runtimeUrl"))} type="url"
                        value={form.runtimeUrl} onChange={set("runtimeUrl")} onBlur={touch("runtimeUrl")} placeholder="https://app.example.com" />
                    </Field>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setStep(2)} className={btnSecondary}>← Back</button>
                    <button type="button" onClick={handleContinue3} className={btnPrimary}>Continue →</button>
                  </div>
                </div>
              )}

              {/* ── Step 4: AI Setup ── */}
              {step === 4 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">AI Setup</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Choose how A11yBot drafts conformance language. You can change this later in Settings.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {/* OpenRouter */}
                    <ProviderCard
                      selected={form.aiProvider === "openrouter"}
                      onClick={() => setForm((p) => ({ ...p, aiProvider: "openrouter", aiModel: p.aiModel || DEFAULT_OPENROUTER_MODEL }))}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">OpenRouter</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">Recommended</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">Access Claude, GPT-4o, Gemini and 100+ models with one API key</p>
                    </ProviderCard>

                    {form.aiProvider === "openrouter" && (
                      <div className="ml-7 space-y-3 pt-1">
                        <Field label="API Key" error={fieldError("aiApiKey")}>
                          <div className="flex gap-2">
                            <input
                              aria-label="OpenRouter API Key"
                              type="password"
                              className={inputCls(!!fieldError("aiApiKey")) + " flex-1"}
                              value={form.aiApiKey}
                              onChange={set("aiApiKey")}
                              onBlur={touch("aiApiKey")}
                              placeholder="sk-or-v1-…"
                            />
                            <button
                              type="button"
                              onClick={handleTest}
                              disabled={!form.aiApiKey || !form.aiModel || testResult.status === "testing"}
                              className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors whitespace-nowrap"
                            >
                              {testResult.status === "testing" ? "Testing…" : "Test"}
                            </button>
                          </div>
                          <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                            Get a free OpenRouter key →
                          </a>
                        </Field>

                        <Field label="Model">
                          <select aria-label="AI Model" className={inputCls(false)}
                            value={form.aiModel} onChange={(e) => setForm((p) => ({ ...p, aiModel: e.target.value }))}>
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
                        </Field>
                      </div>
                    )}

                    {/* Ollama */}
                    <ProviderCard
                      selected={form.aiProvider === "ollama"}
                      disabled={ollamaStatus !== null && !ollamaStatus.available}
                      onClick={() => {
                        if (ollamaStatus?.available) {
                          setForm((p) => ({ ...p, aiProvider: "ollama", aiModel: ollamaStatus.models[0] ?? "" }));
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">Ollama</span>
                        <span className="text-xs text-gray-400">local · free · private</span>
                        {ollamaStatus === null && <span className="text-xs text-gray-400">Detecting…</span>}
                        {ollamaStatus?.available && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
                            Detected · {ollamaStatus.models.length} model{ollamaStatus.models.length !== 1 ? "s" : ""}
                          </span>
                        )}
                        {ollamaStatus && !ollamaStatus.available && (
                          <span className="text-xs text-red-500">Not detected</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Run models privately on your machine.{" "}
                        {ollamaStatus && !ollamaStatus.available && (
                          <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            Install Ollama →
                          </a>
                        )}
                      </p>
                    </ProviderCard>

                    {form.aiProvider === "ollama" && ollamaStatus?.available && (
                      <div className="ml-7 space-y-2 pt-1">
                        <Field label="Model">
                          <select aria-label="Ollama Model" className={inputCls(false)}
                            value={form.aiModel} onChange={(e) => setForm((p) => ({ ...p, aiModel: e.target.value }))}>
                            {ollamaStatus.models.map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </Field>
                        <p className="text-xs text-amber-600">
                          ⚠ Local models produce less reliable conformance language. Review AI drafts carefully before export.
                        </p>
                      </div>
                    )}

                    {/* Skip */}
                    <ProviderCard
                      selected={form.aiProvider === "none"}
                      onClick={() => setForm((p) => ({ ...p, aiProvider: "none", aiModel: "" }))}
                    >
                      <span className="text-sm font-medium text-gray-900">Skip for now</span>
                      <p className="text-xs text-gray-500 mt-0.5">Interview-only mode — no AI drafting. Add a provider later in Settings.</p>
                    </ProviderCard>
                  </div>

                  {testResult.status === "ok" && (
                    <div className="rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm p-3">
                      ✓ Connection successful — ready to draft
                    </div>
                  )}
                  {testResult.status === "error" && (
                    <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
                      {testResult.message}
                    </div>
                  )}
                  {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{error}</div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setStep(3)} className={btnSecondary}>← Back</button>
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

function ProviderCard({ selected, disabled, onClick, children }: { selected: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
        selected ? "border-blue-500 bg-blue-50" :
        disabled ? "border-gray-100 opacity-50 cursor-not-allowed" :
        "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "border-blue-500" : "border-gray-400"}`}>
          {selected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
        </div>
        <div className="flex-1">{children}</div>
      </div>
    </button>
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
    <button type="button" onClick={onClick}
      className={`text-left p-3 rounded-lg border-2 transition-colors ${selected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
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
