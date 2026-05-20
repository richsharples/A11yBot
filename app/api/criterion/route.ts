import { NextRequest, NextResponse } from "next/server";
import { updateCriterion, addEvidence } from "@/src/state/project";
import { UpdateCriterionPayloadSchema, InterviewAnswerPayloadSchema } from "@/src/types";

// PATCH /api/criterion — PM updates a criterion (sets pm-confirmed)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const payload = UpdateCriterionPayloadSchema.parse(body);
    const cs = updateCriterion(payload.criterionId, {
      level: payload.level,
      remark: payload.remark,
      confidence: "pm-confirmed",
    });
    return NextResponse.json(cs);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

// POST /api/criterion/interview — store interview answer as evidence
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const payload = InterviewAnswerPayloadSchema.parse(body);
    addEvidence(payload.criterionId, {
      source: "interview",
      detail: payload.answer,
      capturedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
