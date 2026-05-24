import type { Evidence, Criterion } from "../types";

export const SYSTEM_PROMPT = `You are an accessibility analyst drafting one row of a VPAT 2.5 Accessibility Conformance Report.

You will receive: the criterion's official text, evidence collected from automated scanners, and (optionally) a product manager's free-text answer about how their product handles this criterion.

Your job is to:
1. Pick exactly one conformance level from: supports, partial, doesNotSupport, notApplicable, or notEvaluated
2. Draft the Remarks/Explanations text in the voice of a vendor-authored ACR: factual, third-person, no marketing language, 1–4 sentences.

Rules:
- Never claim "supports" on the basis of scanner evidence alone — scanners cannot prove conformance, only detect failures.
- If the scanner found violations, the level is "partial" or "doesNotSupport".
- If the PM's answer indicates the criterion does not apply to the product, return "notApplicable" and explain why in the remark.
- If the PM's answer indicates full conformance with specifics, you may return "supports".
- If there is no scanner evidence and no PM answer, use the product description and criterion text to make a reasonable best-effort assessment. For typical commercial web/software products, many WCAG criteria can be tentatively assessed as "partial" (acknowledging unknown areas) with a note that manual verification is needed. Only return "notEvaluated" when the criterion clearly cannot be assessed from the available context (e.g. hardware criteria for a software product).

Output JSON only, matching this exact schema:
{
  "level": "supports" | "partial" | "doesNotSupport" | "notApplicable" | "notEvaluated",
  "remark": string
}`;

export function buildUserPrompt(params: {
  productName: string;
  productVersion: string;
  productDescription: string;
  criterion: Criterion;
  evidence: Evidence[];
  pmAnswer?: string;
}): string {
  const { productName, productVersion, productDescription, criterion, evidence, pmAnswer } = params;

  const evidenceText = evidence.length === 0
    ? "(none)"
    : evidence.map((e) => `- [${e.source}]${e.rawId ? ` [${e.rawId}]` : ""} ${e.detail}${e.ref ? ` — ${e.ref}` : ""}`).join("\n");

  return `PRODUCT: ${productName} ${productVersion}
DESCRIPTION: ${productDescription}

CRITERION ID: ${criterion.id}
CRITERION REF: ${criterion.ref}
CRITERION TEXT: ${criterion.text}

EVIDENCE FROM SCANNERS (${evidence.filter((e) => e.source !== "interview").length} items):
${evidenceText}

PM ANSWER (interview):
${pmAnswer ?? "(none)"}

Respond with JSON only:
{
  "level": "supports" | "partial" | "doesNotSupport" | "notApplicable" | "notEvaluated",
  "remark": string
}`;
}
