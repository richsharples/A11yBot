import { NextRequest, NextResponse } from "next/server";
import { getCriteriaStatus, triggerUpdateCheck, ensureCriteriaStore } from "@/src/state/criteria-store";

export async function GET() {
  try {
    await ensureCriteriaStore();
    const status = await getCriteriaStatus();
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST triggers an immediate update check regardless of the 24-hour interval
export async function POST() {
  try {
    const result = await triggerUpdateCheck();
    const status = await getCriteriaStatus();
    return NextResponse.json({ ...status, ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
