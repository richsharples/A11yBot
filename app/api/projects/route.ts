import { NextRequest, NextResponse } from "next/server";
import { createProject } from "@/src/state/project";
import { listProjects } from "@/src/state/project-store";
import { CreateProjectPayloadSchema } from "@/src/types";
import { setProviderConfig } from "@/src/state/provider";
import { ensureCriteriaStore } from "@/src/state/criteria-store";

export async function GET() {
  return NextResponse.json(listProjects());
}

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
