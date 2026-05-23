import { callLLM } from "./client";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts";
import { AiDraftResponseSchema, type AiDraftResponse, type Confidence } from "../types";
import { requireProject, getCriteriaFile } from "../state/project";
import { log, writeRunLog } from "../state/log";

export function deriveConfidence(pmAnswer: string | undefined): Confidence {
  return pmAnswer ? "ai-drafted" : "ai-inferred";
}

function extractJson(text: string): string {
  // Fast path: already clean JSON
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;

  // Strip markdown fences
  const fenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  if (fenced.startsWith("{")) return fenced;

  // Find first balanced {...} block — handles models that wrap JSON in prose
  const start = text.indexOf("{");
  if (start === -1) throw new SyntaxError("No JSON object found in LLM response");
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  throw new SyntaxError("Unterminated JSON object in LLM response");
}

async function callWithParse(userPrompt: string): Promise<AiDraftResponse> {
  const text = await callLLM(SYSTEM_PROMPT, userPrompt);
  const jsonText = extractJson(text);
  return AiDraftResponseSchema.parse(JSON.parse(jsonText));
}

export async function draftCriterion(criterionId: string): Promise<AiDraftResponse> {
  const project = requireProject();
  const cs = project.criteria[criterionId];
  if (!cs) throw new Error(`Unknown criterion: ${criterionId}`);

  const criteriaFile = getCriteriaFile(project.edition);
  let criterion = null;
  for (const chapter of criteriaFile.chapters) {
    const found = chapter.criteria.find((c) => c.id === criterionId);
    if (found) { criterion = found; break; }
  }
  if (!criterion) throw new Error(`Criterion ${criterionId} not found in criteria file`);

  const pmAnswer = cs.evidence.find((e) => e.source === "interview")?.detail;

  const userPrompt = buildUserPrompt({
    productName: project.productName,
    productVersion: project.productVersion,
    productDescription: project.productDescription,
    criterion,
    evidence: cs.evidence,
    pmAnswer,
  });

  log.info({ event: "ai.draft.requested", criterionId });
  writeRunLog({ event: "ai.draft.requested", criterionId });

  let result: AiDraftResponse;
  try {
    result = await callWithParse(userPrompt);
  } catch (err) {
    log.warn({ err, criterionId }, "First AI parse attempt failed, retrying");
    const retryPrompt = userPrompt + "\n\nYour previous output was not valid JSON. Please return ONLY valid JSON matching the schema, with no markdown, no explanation.";
    try {
      result = await callWithParse(retryPrompt);
    } catch (err2) {
      log.error({ err: err2, criterionId }, "AI draft failed on retry");
      writeRunLog({ event: "ai.draft.failed", criterionId, err: String(err2) });
      const msg = String(err2);
      let remark: string;
      if (msg.includes("401") || msg.includes("authentication") || msg.includes("invalid_api_key")) {
        remark = "AI draft failed: invalid API key. Check your key in Settings.";
      } else if (msg.includes("402") || msg.includes("credit") || msg.includes("balance")) {
        remark = "AI draft failed: insufficient credits. Top up your account and retry.";
      } else if (msg.includes("No AI provider")) {
        remark = "AI draft failed: no provider configured. Open Settings to set up OpenRouter or Ollama.";
      } else {
        remark = `AI draft failed: ${msg}`;
      }
      return { level: "notEvaluated", remark, reasoning: msg };
    }
  }

  const confidence = deriveConfidence(pmAnswer);
  writeRunLog({ event: "ai.draft.returned", criterionId, result, confidence });
  return result;
}
