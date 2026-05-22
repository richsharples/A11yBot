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
    const project = await this.json<{ id: string }>("/api/project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return project.id;
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
    }>("/api/project");
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
}
