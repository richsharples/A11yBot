import { NextRequest, NextResponse } from "next/server";
import { draftCriterion, deriveConfidence } from "@/src/ai/draft";
import { updateCriterion, requireProject } from "@/src/state/project";

// Allow up to 5 minutes — local models can be slow
export const maxDuration = 300;

// POST /api/ai/draft — draft one criterion or all notEvaluated
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { criterionId, draftAll } = body as { criterionId?: string; draftAll?: boolean };

    if (draftAll) {
      const project = requireProject();
      const notEvaluated = Object.keys(project.criteria).filter(
        (id) => project.criteria[id].level === "notEvaluated"
      );

      // Process in batches of 5
      const BATCH = 5;
      const results: Record<string, { level: string; remark: string }> = {};

      for (let i = 0; i < notEvaluated.length; i += BATCH) {
        const batch = notEvaluated.slice(i, i + BATCH);
        await Promise.all(
          batch.map(async (id) => {
            const draft = await draftCriterion(id);
            const pmAnswer = project.criteria[id].evidence.find((e) => e.source === "interview")?.detail;
            const confidence = draft.level === "notEvaluated" ? "ai-attempted" : deriveConfidence(pmAnswer);
            updateCriterion(id, { level: draft.level, remark: draft.remark, confidence });
            results[id] = { level: draft.level, remark: draft.remark };
          })
        );
      }

      return NextResponse.json({ draftAll: true, updated: Object.keys(results).length, results });
    }

    if (!criterionId) {
      return NextResponse.json({ error: "criterionId or draftAll required" }, { status: 400 });
    }

    const project = requireProject();
    const draft = await draftCriterion(criterionId);
    const pmAnswer = project.criteria[criterionId]?.evidence.find((e) => e.source === "interview")?.detail;
    // ai-attempted = AI tried but couldn't assess (returned notEvaluated); distinguishes from un-attempted criteria
    const confidence = draft.level === "notEvaluated" ? "ai-attempted" : deriveConfidence(pmAnswer);
    const cs = updateCriterion(criterionId, { level: draft.level, remark: draft.remark, confidence });

    return NextResponse.json({ ...cs, reasoning: draft.reasoning });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
