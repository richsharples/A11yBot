/**
 * Thin HTTP client for the a11ybot API.
 * All functions throw on non-2xx responses.
 */

export interface SourceScanResult {
  filesFound: { jsx: number; html: number; vue: number; css: number };
  evidenceAdded: number;
  criteriaHit: number;
}

export interface ProjectCriteria {
  total: number;
  notApplicable: number;
  notEvaluated: number;
}

export class VpatApiClient {
  constructor(private readonly baseUrl: string) {}

  private async json<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, init);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async ping(): Promise<boolean> {
    try {
      await fetch(`${this.baseUrl}/api/criteria-status`);
      return true;
    } catch {
      return false;
    }
  }

  async getToolVersion(): Promise<string> {
    const status = await this.json<{ manifest?: { criteriaVersion: string } }>("/api/criteria-status");
    return status.manifest?.criteriaVersion ?? "unknown";
  }

  async createProject(params: {
    productName: string;
    productVersion: string;
    productDescription: string;
    contactName: string;
    contactEmail: string;
    edition: "508" | "INT";
    mode: "interview";
    productComponents: string[];
  }): Promise<string> {
    const project = await this.json<{ id: string }>("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return project.id;
  }

  async listProjects(): Promise<Array<{ id: string; productName: string; productVersion: string; progressPct: number }>> {
    return this.json("/api/projects");
  }

  async loadProject(id: string): Promise<Record<string, unknown>> {
    return this.json(`/api/projects/${id}`);
  }

  async runSourceScan(sourcePath: string): Promise<SourceScanResult> {
    const result = await this.json<{
      scanned: { jsx: number; html: number; vue: number; css: number };
      evidenceAdded: number;
      criteriaWithEvidence: number;
    }>("/api/scan/source", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourcePath }),
    });
    return {
      filesFound: result.scanned,
      evidenceAdded: result.evidenceAdded,
      criteriaHit: result.criteriaWithEvidence,
    };
  }

  async getCriteriaState(): Promise<ProjectCriteria> {
    const project = await this.json<{
      criteria: Record<string, { level: string }>;
    }>("/api/projects/active");
    const all = Object.values(project.criteria);
    return {
      total: all.length,
      notApplicable: all.filter((c) => c.level === "notApplicable").length,
      notEvaluated: all.filter((c) => c.level === "notEvaluated").length,
    };
  }

  async exportDocx(): Promise<{ success: boolean; sizeKb: number }> {
    const res = await fetch(`${this.baseUrl}/api/export`, { method: "POST" });
    if (!res.ok) return { success: false, sizeKb: 0 };
    const bytes = await res.arrayBuffer();
    return { success: true, sizeKb: Math.round(bytes.byteLength / 1024) };
  }

  async resetProject(): Promise<void> {
    await fetch(`${this.baseUrl}/api/projects/active`, { method: "DELETE" });
  }

  async getProject(): Promise<Record<string, unknown>> {
    return this.json<Record<string, unknown>>("/api/projects/active");
  }

  async updateCriterion(criterionId: string, level: string, remark: string): Promise<Record<string, unknown>> {
    return this.json<Record<string, unknown>>("/api/criterion", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criterionId, level, remark }),
    });
  }

  async resetCriterion(criterionId: string): Promise<Record<string, unknown>> {
    return this.json<Record<string, unknown>>("/api/criterion", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criterionId, level: "notEvaluated", remark: "" }),
    });
  }

  async submitInterviewAnswer(criterionId: string, answer: string): Promise<void> {
    await this.json("/api/criterion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criterionId, answer }),
    });
  }

  async exportDocxBuffer(): Promise<{ success: boolean; sizeKb: number; buffer?: ArrayBuffer }> {
    const res = await fetch(`${this.baseUrl}/api/export`, { method: "POST" });
    if (!res.ok) return { success: false, sizeKb: 0 };
    const buffer = await res.arrayBuffer();
    return { success: true, sizeKb: Math.round(buffer.byteLength / 1024), buffer };
  }

  async getUserConfig(): Promise<Record<string, unknown>> {
    return this.json<Record<string, unknown>>("/api/user-config");
  }

  async patchUserConfig(patch: Record<string, unknown>): Promise<void> {
    await this.json("/api/user-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }
}
