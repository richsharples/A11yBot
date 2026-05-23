import { z } from "zod";

// ─── Conformance ──────────────────────────────────────────────────────────────

export const ConformanceLevelSchema = z.enum([
  "supports",
  "partial",
  "doesNotSupport",
  "notApplicable",
  "notEvaluated",
]);
export type ConformanceLevel = z.infer<typeof ConformanceLevelSchema>;

export const EditionSchema = z.enum(["508", "INT"]);
export type Edition = z.infer<typeof EditionSchema>;

export const ProductComponentSchema = z.enum(["web", "software", "hardware", "docs", "support"]);
export type ProductComponent = z.infer<typeof ProductComponentSchema>;

export const InputModeSchema = z.enum(["source", "runtime", "interview", "hybrid"]);
export type InputMode = z.infer<typeof InputModeSchema>;

// ─── Criteria file schema ─────────────────────────────────────────────────────

export const ScannerSignalsSchema = z.object({
  eslintRules: z.array(z.string()).optional(),
  axeRules: z.array(z.string()).optional(),
  lighthouseAudits: z.array(z.string()).optional(),
});

export const CrossRefSchema = z.object({
  standard: z.enum(["508", "EN301549", "WCAG"]),
  id: z.string(),
});

export const CriterionSchema = z.object({
  id: z.string(),
  ref: z.string(),
  text: z.string(),
  appliesTo: z.array(z.enum(["software", "web", "docs", "support", "hardware"])),
  crossRefs: z.array(CrossRefSchema).optional(),
  interviewQuestion: z.string().optional(),
  scannerSignals: ScannerSignalsSchema.optional(),
});
export type Criterion = z.infer<typeof CriterionSchema>;

export const ChapterSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  criteria: z.array(CriterionSchema),
});
export type Chapter = z.infer<typeof ChapterSchema>;

export const CriteriaFileSchema = z.object({
  edition: EditionSchema,
  version: z.string(),
  generatedFrom: z.string(),
  chapters: z.array(ChapterSchema),
});
export type CriteriaFile = z.infer<typeof CriteriaFileSchema>;

// ─── Project state ────────────────────────────────────────────────────────────

export const EvidenceSourceSchema = z.enum(["source-scan", "runtime-scan", "interview", "manual"]);
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;

export const EvidenceSchema = z.object({
  source: EvidenceSourceSchema,
  detail: z.string(),
  ref: z.string().optional(),
  rawId: z.string().optional(),
  capturedAt: z.string(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const ConfidenceSchema = z.enum(["ai-inferred", "ai-drafted", "pm-confirmed"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const HistoryEntrySchema = z.object({
  at: z.string(),
  level: ConformanceLevelSchema,
  remark: z.string(),
});

export const CriterionStateSchema = z.object({
  id: z.string(),
  level: ConformanceLevelSchema,
  remark: z.string(),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema),
  history: z.array(HistoryEntrySchema),
});
export type CriterionState = z.infer<typeof CriterionStateSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  productName: z.string(),
  productVersion: z.string(),
  productDescription: z.string(),
  contactName: z.string(),
  contactEmail: z.string(),
  edition: EditionSchema,
  mode: InputModeSchema,
  productComponents: z.array(ProductComponentSchema),
  sourcePath: z.string().optional(),
  runtimeUrl: z.string().optional(),
  createdAt: z.string(),
  criteria: z.record(z.string(), CriterionStateSchema),
});
export type Project = z.infer<typeof ProjectSchema>;

// ─── AI provider ─────────────────────────────────────────────────────────────

export const ProviderSchema = z.object({
  provider: z.enum(["openrouter", "ollama", "none"]),
  apiKey: z.string().optional(),
  model: z.string(),
});
export type ProviderConfig = z.infer<typeof ProviderSchema>;

// ─── User config ─────────────────────────────────────────────────────────────

export const SavedProductSchema = z.object({
  name: z.string().min(1),
  version: z.string().default(""),
  description: z.string().default(""),
  components: z.array(ProductComponentSchema).default([]),
  edition: EditionSchema.default("508"),
  mode: InputModeSchema.default("interview"),
  sourcePath: z.string().optional(),
  runtimeUrl: z.string().optional(),
  apiKey: z.string().optional(),
});
export type SavedProduct = z.infer<typeof SavedProductSchema>;

export const UserConfigSchema = z.object({
  port: z.number().default(5173),
  openBrowser: z.boolean().default(true),
  contact: z.object({
    name: z.string().default(""),
    email: z.string().default(""),
  }).default({}),
  aiDefaults: z.object({
    provider: z.enum(["openrouter", "ollama", "none"]).default("none"),
    model: z.string().default(""),
    apiKey: z.string().optional(),
  }).default({}),
  products: z.array(SavedProductSchema).default([]),
});
export type UserConfig = z.infer<typeof UserConfigSchema>;

// ─── API payloads ─────────────────────────────────────────────────────────────

export const CreateProjectPayloadSchema = z.object({
  productName: z.string().min(1),
  productVersion: z.string().min(1),
  productDescription: z.string().min(1),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  edition: EditionSchema,
  mode: InputModeSchema,
  productComponents: z.array(ProductComponentSchema).min(1, "Select at least one component type"),
  sourcePath: z.string().optional(),
  runtimeUrl: z.string().url().optional(),
  providerConfig: ProviderSchema.optional(),
});
export type CreateProjectPayload = z.infer<typeof CreateProjectPayloadSchema>;

export const UpdateCriterionPayloadSchema = z.object({
  criterionId: z.string(),
  level: ConformanceLevelSchema,
  remark: z.string(),
});
export type UpdateCriterionPayload = z.infer<typeof UpdateCriterionPayloadSchema>;

export const InterviewAnswerPayloadSchema = z.object({
  criterionId: z.string(),
  answer: z.string().min(1),
});

export const SourceScanPayloadSchema = z.object({
  sourcePath: z.string().min(1),
});

export const RuntimeScanPayloadSchema = z.object({
  url: z.string().url(),
  paths: z.array(z.string()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

// ─── AI response ──────────────────────────────────────────────────────────────

export const AiDraftResponseSchema = z.object({
  // reasoning is optional — omitting it saves ~100 tokens per response on local models
  level: ConformanceLevelSchema,
  remark: z.string(),
  reasoning: z.string().optional(),
});
export type AiDraftResponse = z.infer<typeof AiDraftResponseSchema>;
