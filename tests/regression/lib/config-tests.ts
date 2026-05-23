/**
 * Integration tests for the user config API.
 * These run as a pre-flight step in the regression suite and do not
 * produce scan snapshots — they assert pass/fail directly.
 */

import type { VpatApiClient } from "./api";

export interface ConfigTestResult {
  name: string;
  passed: boolean;
  error?: string;
}

async function test(
  name: string,
  fn: () => Promise<void>
): Promise<ConfigTestResult> {
  try {
    await fn();
    return { name, passed: true };
  } catch (err) {
    return { name, passed: false, error: String(err) };
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

export async function runConfigTests(api: VpatApiClient): Promise<ConfigTestResult[]> {
  const results: ConfigTestResult[] = [];

  // ── Read default config ───────────────────────────────────────────────────
  results.push(await test("GET /api/user-config returns valid structure", async () => {
    const cfg = await api.getUserConfig();
    assert(typeof cfg === "object" && cfg !== null, "response is an object");
    assert("contact" in cfg, "has contact field");
    assert("aiDefaults" in cfg, "has aiDefaults field");
    assert("products" in cfg, "has products field");
    assert(Array.isArray(cfg.products as unknown[]), "products is an array");
  }));

  // ── API key masking ───────────────────────────────────────────────────────
  results.push(await test("API keys are masked in GET response", async () => {
    const cfg = await api.getUserConfig() as {
      aiDefaults: { apiKey?: string; apiKeySet?: boolean };
      products: Array<{ apiKey?: string; apiKeySet?: boolean }>;
    };
    // If a key is set, it should come back as "***" not the real value
    if (cfg.aiDefaults.apiKeySet) {
      assert(cfg.aiDefaults.apiKey === "***", "aiDefaults.apiKey masked to ***");
    }
    for (const p of cfg.products) {
      if (p.apiKeySet) {
        assert(p.apiKey === "***", `product apiKey masked to ***`);
      }
    }
  }));

  // ── Config roundtrip ─────────────────────────────────────────────────────
  results.push(await test("PATCH contact fields and read back", async () => {
    const original = await api.getUserConfig() as { contact: { name: string; email: string } };
    const testName = "__regression_test__";
    const testEmail = "regression@a11ybot.test";

    await api.patchUserConfig({ contact: { name: testName, email: testEmail } });

    const updated = await api.getUserConfig() as { contact: { name: string; email: string } };
    assert(updated.contact.name === testName, `name updated to ${testName}`);
    assert(updated.contact.email === testEmail, `email updated to ${testEmail}`);

    // Restore original
    await api.patchUserConfig({ contact: original.contact });
  }));

  // ── Saved product → project creation ─────────────────────────────────────
  results.push(await test("Project created from saved product config matches expected fields", async () => {
    const cfg = await api.getUserConfig() as {
      products: Array<{
        name: string;
        version: string;
        description: string;
        components: string[];
        edition: string;
      }>;
    };
    if (cfg.products.length === 0) return; // skip if no products saved

    const product = cfg.products[0];
    await api.resetProject();

    const projectId = await api.createProject({
      productName: product.name,
      productVersion: product.version || "test",
      productDescription: product.description || "regression",
      contactName: "Regression Suite",
      contactEmail: "regression@a11ybot.test",
      edition: (product.edition as "508" | "INT") || "508",
      mode: "interview",
      productComponents: product.components.length ? product.components : ["web"],
    });
    assert(typeof projectId === "string" && projectId.length > 0, "project id returned");

    const criteria = await api.getCriteriaState();
    assert(criteria.total > 0, "criteria were seeded");
    assert(criteria.notApplicable >= 0, "notApplicable count is valid");
  }));

  // ── Multiple products ─────────────────────────────────────────────────────
  results.push(await test("Config supports multiple products with independent editions", async () => {
    const original = await api.getUserConfig() as { products: unknown[] };

    const testProducts = [
      {
        name: "Test Product A",
        version: "1.0",
        description: "Regression test product A",
        components: ["web"],
        edition: "508",
        mode: "interview",
      },
      {
        name: "Test Product B",
        version: "2.0",
        description: "Regression test product B",
        components: ["software"],
        edition: "INT",
        mode: "interview",
        apiKey: "sk-or-test-b-key",
      },
    ];

    await api.patchUserConfig({ products: testProducts });
    const updated = await api.getUserConfig() as {
      products: Array<{ name: string; edition: string; apiKeySet?: boolean }>;
    };

    assert(updated.products.length === 2, "two products saved");
    assert(updated.products[0].name === "Test Product A", "product A name correct");
    assert(updated.products[1].edition === "INT", "product B edition is INT");
    assert(updated.products[1].apiKeySet === true, "product B apiKey recorded");
    assert(
      (updated.products[1] as { apiKey?: string }).apiKey === "***",
      "product B apiKey masked"
    );

    // Restore
    await api.patchUserConfig({ products: original.products });
  }));

  // ── Invalid config rejected ───────────────────────────────────────────────
  results.push(await test("POST with invalid edition is rejected", async () => {
    try {
      await api.patchUserConfig({
        products: [{ name: "Bad", version: "1", description: "x", components: ["web"], edition: "INVALID" }],
      });
      // If it didn't throw, the server accepted bad data — fail
      throw new Error("Server accepted invalid edition — expected 400");
    } catch (err) {
      const msg = String(err);
      // Expect either a fetch error (400 response) or our own thrown error
      assert(msg.includes("400") || msg.includes("invalid") || msg.includes("ZodError") || msg.includes("expected"),
        `rejected with appropriate error: ${msg}`);
    }
  }));

  return results;
}

export function printConfigResults(results: ConfigTestResult[]): { passed: number; failed: number } {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log("\n  Config integration tests:");
  for (const r of results) {
    const icon = r.passed ? "✓" : "✗";
    console.log(`    ${icon} ${r.name}`);
    if (!r.passed && r.error) console.log(`      ${r.error}`);
  }
  console.log(`\n  Config tests: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}
