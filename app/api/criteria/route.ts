import { NextRequest, NextResponse } from "next/server";
import { getCriteriaFile } from "@/src/state/project";
import type { Edition } from "@/src/types";

export async function GET(req: NextRequest) {
  const edition = (req.nextUrl.searchParams.get("edition") ?? "508") as Edition;
  try {
    const file = getCriteriaFile(edition);
    return NextResponse.json(file);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
