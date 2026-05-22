import { NextRequest, NextResponse } from "next/server";
import { createProject, getProject } from "@/src/state/project";
import { CreateProjectPayloadSchema } from "@/src/types";
import { setProviderConfig } from "@/src/state/provider";
import { ensureCriteriaStore } from "@/src/state/criteria-store";

export async function POST(req: NextRequest) {
  try {
    await ensureCriteriaStore();
    const body = await req.json();
    const payload = CreateProjectPayloadSchema.parse(body);

    if (payload.providerConfig) {
      setProviderConfig(payload.providerConfig);
    }

    const project = createProject(payload);
    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function GET() {
  const project = getProject();
  if (!project) return NextResponse.json({ error: "No active project" }, { status: 404 });
  return NextResponse.json(project);
}
