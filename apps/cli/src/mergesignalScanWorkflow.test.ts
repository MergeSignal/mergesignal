import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parse } from "yaml";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

describe("MergeSignal GitHub workflow contract", () => {
  it("mergesignal-scan.yml uses MergeSignal / analysis with PR context gate and literal trusted profile", () => {
    const doc = parse(
      readFileSync(
        join(repoRoot, ".github/workflows/mergesignal-scan.yml"),
        "utf8",
      ),
    ) as Record<string, unknown>;

    expect(doc.name).toBe("MergeSignal");

    const jobs = doc.jobs as Record<string, unknown>;
    expect(jobs.scan).toBeUndefined();
    expect(jobs.analysis).toBeDefined();

    const analysis = jobs.analysis as Record<string, unknown>;
    expect(analysis.if).toBeUndefined();
    expect(analysis.env).toBeDefined();
    expect(
      String(
        (analysis.env as Record<string, unknown>)
          .MERGESIGNAL_ENGINE_REPO_TOKEN ?? "",
      ),
    ).toContain("secrets.MERGESIGNAL_ENGINE_REPO_TOKEN");

    const yamlText = readFileSync(
      join(repoRoot, ".github/workflows/mergesignal-scan.yml"),
      "utf8",
    );
    expect(yamlText).toContain("scan-surface-copy.generated.json");
    expect(yamlText).toContain("actions.prAnalysisUnavailableFork");
    expect(yamlText).toContain("actions.prAnalysisUnavailableDependabot");
    expect(yamlText).toContain("actions.pushTrustedScanSkippedNoEngineToken");
    expect(yamlText).toContain("actions.trustedWorkflowSecretMissing");
    expect(yamlText).toContain("MergeSignal/mergesignal");
    expect(yamlText).toContain("fail_trusted_required_no_pat");
    expect(yamlText).toContain("exit 1");
    expect(yamlText).toContain("MS_ENGINE_PAT");
    expect(yamlText).toContain("MERGESIGNAL_ENGINE_REPO_TOKEN");
    expect(yamlText).toContain("id: ms_context");
    expect(yamlText).toContain(
      "steps.ms_context.outputs.run_trusted_scan == 'true'",
    );

    const steps = analysis.steps as Array<Record<string, unknown>>;
    const scanStep = steps.find((s) =>
      String(s.uses ?? "").includes("merge-signal-scan"),
    );
    expect(scanStep, "MergeSignal scan composite step").toBeTruthy();
    const withBlock = scanStep?.with as Record<string, string> | undefined;
    expect(withBlock?.scan_profile).toBe("trusted");
    expect(withBlock?.engine_repo_token).toContain(
      "secrets.MERGESIGNAL_ENGINE_REPO_TOKEN",
    );
    expect(yamlText).toContain("packages/analysis-engine/dist/index.js");
  });

  it("merge-signal-scan action checks out the trusted engine from GitHub", () => {
    const action = parse(
      readFileSync(
        join(repoRoot, ".github/actions/merge-signal-scan/action.yml"),
        "utf8",
      ),
    ) as {
      inputs?: Record<string, { default?: string }>;
      runs?: { steps?: Array<Record<string, unknown>> };
    };

    expect(action.inputs?.engine_repo_token).toBeDefined();
    expect(action.inputs?.engine_repository?.default).toBe(
      "MergeSignal/mergesignal-engine",
    );
    expect(action.inputs?.engine_impl_file?.default).toBe(
      "packages/analysis-engine/dist/index.js",
    );

    const steps = action.runs?.steps ?? [];
    const engineCheckout = steps.find((s) =>
      String(s.name ?? "").includes("Checkout private MergeSignal engine"),
    );
    expect(engineCheckout, "engine checkout step").toBeTruthy();
    const checkoutWith = engineCheckout?.with as
      | Record<string, string>
      | undefined;
    expect(String(checkoutWith?.["persist-credentials"])).toBe("false");
    expect(String(checkoutWith?.token)).toContain(
      "env.MERGESIGNAL_ENGINE_REPO_TOKEN",
    );
  });

  it("ci.yml does not expose trusted-scan-fixture on pull_request", () => {
    const doc = parse(
      readFileSync(join(repoRoot, ".github/workflows/ci.yml"), "utf8"),
    ) as Record<string, unknown>;
    const jobs = doc.jobs as Record<string, unknown>;
    expect(jobs["trusted-scan-fixture"]).toBeUndefined();
  });

  it("trusted-engine-verification.yml is not triggered by pull_request", () => {
    const doc = parse(
      readFileSync(
        join(repoRoot, ".github/workflows/trusted-engine-verification.yml"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    const on = doc.on as Record<string, unknown> | string;
    expect(on).toBeDefined();
    if (on && typeof on === "object") {
      expect(on.pull_request).toBeUndefined();
    }
  });
});
