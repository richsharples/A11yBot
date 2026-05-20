import { NextResponse } from "next/server";
import { requireProject } from "@/src/state/project";
import { renderDocx } from "@/src/docx/render";
import { log, writeRunLog } from "@/src/state/log";
import { writeFileSync } from "fs";
import { join } from "path";

export async function POST() {
  try {
    const project = requireProject();
    log.info({ event: "export", projectId: project.id });
    writeRunLog({ event: "export", projectId: project.id, project });

    const buffer = await renderDocx(project);

    const date = new Date().toISOString().slice(0, 10);
    const safeName = project.productName.replace(/[^a-zA-Z0-9-]/g, "_");
    const filename = `vpat-${safeName}-${date}.docx`;

    // Also write to cwd
    try {
      writeFileSync(join(process.cwd(), filename), buffer);
    } catch (err) {
      log.warn({ err }, "Could not write .docx to cwd");
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    log.error({ err }, "Export failed");
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
