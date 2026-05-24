import { NextRequest, NextResponse } from "next/server";
import { getProject, resetProject, updateProjectPaths } from "@/src/state/project";
import { loadProjectFile, deleteProject } from "@/src/state/project-store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  if (id === "active") {
    const project = getProject();
    if (!project) return NextResponse.json({ error: "No active project" }, { status: 404 });
    return NextResponse.json(project);
  }

  try {
    const project = loadProjectFile(id);
    // Load into the in-memory store so all subsequent API calls can use it
    (globalThis as { __vpatProject: typeof project }).__vpatProject = project;
    return NextResponse.json(project);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const { sourcePath, runtimeUrl } = await req.json() as { sourcePath?: string; runtimeUrl?: string };
    const project = updateProjectPaths(sourcePath, runtimeUrl);
    if (project.id !== id && id !== "active") {
      return NextResponse.json({ error: "Project ID mismatch" }, { status: 400 });
    }
    return NextResponse.json(project);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (id === "active") {
    resetProject();
    return new NextResponse(null, { status: 204 });
  }
  try {
    deleteProject(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 404 });
  }
}
