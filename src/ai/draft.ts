import { getClient } from "./client";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts";
import { AiDraftResponseSchema, type AiDraftResponse, type Confidence } from "../types";
import { requireProject, getCriteriaFile } from "../state/project";
import { log, writeRunLog } from "../state/log";

export function deriveConfidence(pmAnswer: string | undefined): Confidence {
  return pmAnswer ? "ai-drafted" : "ai-inferred";
}

const DEFAULT_MODEL = process.env.VPAT_MODEL ?? "claude-sonnet-4-6";

async function callClaude(userPrompt: string): Promise<AiDraftResponse> {
  const client = getClient();

  const message = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  // Strip markdown fences if present
  const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
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
  const scannerEvidence = cs.evidence.filter((e) => e.source !== "interview");

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
    result = await callClaude(userPrompt);
  } catch (err) {
    log.warn({ err, criterionId }, "First AI parse attempt failed, retrying");
    // Retry with correction
    const retryPrompt = userPrompt + "\n\nYour previous output was not valid JSON. Please return ONLY valid JSON matching the schema, with no markdown, no explanation.";
    try {
      result = await callClaude(retryPrompt);
    } catch (err2) {
      log.error({ err: err2, criterionId }, "AI draft failed on retry");
      writeRunLog({ event: "ai.draft.failed", criterionId, err: String(err2) });
      const msg = String(err2);
      let remark: string;
      if (msg.includes("credit balance is too low")) {
        remark = "AI draft failed: your Anthropic API credit balance is too low. Add credits at console.anthropic.com → Plans & Billing, then retry.";
      } else if (msg.includes("invalid_api_key") || msg.includes("authentication") || msg.includes("401")) {
        remark = "AI draft failed: invalid or missing Anthropic API key. Check your key at console.anthropic.com → API Keys.";
      } else if (msg.includes("No Anthropic API key")) {
        remark = "AI draft failed: no Anthropic API key configured. Set ANTHROPIC_API_KEY or enter a key in the setup wizard.";
      } else {
        remark = `AI draft failed: ${msg}`;
      }
      return {
        level: "notEvaluated",
        remark,
        reasoning: msg,
      };
    }
  }

  // If only scanner evidence (no PM answer), mark as ai-inferred
  const confidence = deriveConfidence(pmAnswer);

  writeRunLog({ event: "ai.draft.returned", criterionId, result, confidence });
  return result;
}
