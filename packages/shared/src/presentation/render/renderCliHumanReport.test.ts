import { describe, expect, it } from "vitest";
import type {
  Assessment,
  BoundedVerifyTarget,
} from "../../assessment/types.js";
import type { ScanResult } from "../../types.js";
import { buildScanPresentationBundle } from "../orchestration/buildScanPresentationBundle.js";
import { presentCliScanSummary } from "../presenters/presentCliScanSummary.js";
import { renderCliScanSummaryText } from "./renderCliScanSummaryText.js";
import {
  scanResultFastifyRuntime,
  scanResultTypescriptPatch,
} from "../fixtures/scanResultFixtures.js";
import { scanResultGenericAbstain } from "../fixtures/presentationPersonaFixtures.js";

function render(result: ScanResult, repoLabel = "acme/web"): string {
  const bundle = buildScanPresentationBundle({
    result,
    pipelineStatus: "done",
  });
  expect(bundle).not.toBeNull();
  return renderCliScanSummaryText(
    presentCliScanSummary(bundle!, { repoLabel }),
  );
}

function withAssessment(
  result: ScanResult,
  assessment: Assessment,
  extra: Partial<ScanResult> = {},
): ScanResult {
  return { ...result, ...extra, assessment };
}

describe("CLI human assessment report", () => {
  it("shows why a Safe result was cleared without scores", () => {
    const text = render(scanResultTypescriptPatch);

    expect(text).toContain("typescript");
    expect(text).toContain("Assessment: Safe");
    expect(text).toContain("Why this assessment");
    expect(text).toContain(
      "No dedicated dependency review required beyond normal engineering process.",
    );
    expect(text).not.toMatch(/^Verify$/m);
    expect(text).not.toContain("typecheck");
    expect(text).not.toMatch(/PR Risk/);
    expect(text).not.toContain("Confidence:");
    expect(text).not.toMatch(/\d+%/);
    expect(text.indexOf("typescript")).toBeLessThan(
      text.indexOf("Assessment:"),
    );
  });

  it("shows the Needs Review concern and bounded verification", () => {
    const text = render(scanResultFastifyRuntime);

    expect(text).toContain("fastify");
    expect(text).toContain("Assessment: Needs review");
    expect(text).toContain(
      "Changed package upgrade leaves unresolved runtime exposure that warrants review before merge.",
    );
    expect(text).toContain("Why this assessment");
    expect(text).toContain("HTTP framework infrastructure");
    expect(text).not.toMatch(/^Verify$/m);
    expect(text).not.toMatch(/^routes$/m);
    expect(text).not.toMatch(/^middleware$/m);
    expect(text).toContain(
      "Fastify middleware ordering may affect auth paths.",
    );
    expect(text).not.toMatch(/incompatible/i);
    expect(text).not.toMatch(/proven broken/i);
  });

  it("shows Risky negative evidence and distinct not-affected information", () => {
    const base = scanResultFastifyRuntime.assessment!;
    const text = render(
      withAssessment(
        scanResultFastifyRuntime,
        {
          ...base,
          posture: "risky",
          outcome: "proven_broken",
          reasoning: [
            "The fastify request hook signature is incompatible with apps/api/src/app.ts.",
            "Existing preHandler hooks no longer typecheck.",
          ],
          notAffectedLine: "Queue workers do not import fastify.",
          resolutionLine: null,
          presentation: { ...base.presentation, verificationIntensity: "none" },
          verificationScope: {
            ...base.verificationScope,
            guidance: [],
            focus: [],
          },
        },
        { findings: [], insights: [] },
      ),
    );

    expect(text).toContain("Assessment: Risky");
    expect(text).toContain(
      "The fastify request hook signature is incompatible with apps/api/src/app.ts.",
    );
    expect(text).toContain("Existing preHandler hooks no longer typecheck.");
    expect(text).toContain("Not affected");
    expect(text).toContain("Queue workers do not import fastify.");
    expect(text).not.toMatch(/please review/i);
  });

  it("labels indeterminate results Cannot determine and keeps the gap visible", () => {
    const text = render(scanResultGenericAbstain);

    expect(text).toContain("pkg-a");
    expect(text).toContain("Assessment: Cannot determine");
    expect(text).toContain(
      "Deterministic analysis could not reach a conclusion.",
    );
    expect(text).toContain("Why this assessment");
    expect(text).toContain("Limitations");
    expect(text).toContain("fixture");
    expect(text).not.toContain("PR-specific scan context was limited");
    expect(text).not.toContain("Assessment: Safe");
    expect(text).not.toContain("Assessment: Needs review");
    expect(text).not.toMatch(/probably safe/i);
  });

  it("renders each distinct fact once and does not cap reasoning at three", () => {
    const base = scanResultFastifyRuntime.assessment!;
    const reasoning = [
      "Clearance one: the public type surface is unchanged.",
      "Clearance two: no call site uses the removed helper.",
      "Clearance three: the lockfile change is confined to typescript.",
      "Clearance four: test types still resolve.",
      "Clearance five: declaration emit is unchanged.",
      "Clearance one: the public type surface is unchanged.",
    ];
    const target: BoundedVerifyTarget = {
      targetId: "target-1",
      packageName: "fastify",
      kind: "behavioral_scenario",
      whatToVerify: "auth preHandler behavior",
      whyAutomationStopped: "The hook body is generated at runtime.",
      whatProofWouldResolveIt: "internal-proof-slug",
    };
    const text = render(
      withAssessment(
        scanResultFastifyRuntime,
        {
          ...base,
          posture: "needs_review",
          reasoning,
          notAffectedLine: "Worker entrypoints do not import fastify.",
          resolutionLine:
            "A focused auth request would settle the hook change.",
          verificationScope: {
            ...base.verificationScope,
            guidance: [
              "Exercise the auth route in apps/api/src/routes/session.ts.",
            ],
          },
          boundedVerifyTargets: [target],
          abstainReasons: [
            {
              kind: "insufficient_collection",
              detail: "The base lockfile was partial.",
            },
          ],
          concerns: [
            {
              kind: "unresolved_runtime_exposure",
              rank: 1,
              packages: ["fastify"],
              evidenceRefs: ["fixture:fastify"],
              context: "apps/api/src/app.ts registers the hook.",
            },
          ],
        },
        {
          findings: [
            {
              id: "finding-distinct",
              title: "Hook registration",
              description: "apps/api/src/app.ts registers the hook.",
              severity: "medium",
              packageName: "fastify",
              recommendation:
                "Exercise the auth route in apps/api/src/routes/session.ts.",
            },
          ],
          insights: [],
        },
      ),
    );

    for (const line of reasoning.slice(0, 5)) {
      expect(text.split(line).length - 1).toBe(1);
    }
    expect(text).toContain("apps/api/src/app.ts registers the hook.");
    expect(
      text.split("apps/api/src/app.ts registers the hook.").length - 1,
    ).toBe(1);
    expect(text).toContain(
      "Exercise the auth route in apps/api/src/routes/session.ts.",
    );
    expect(
      text.split("Exercise the auth route in apps/api/src/routes/session.ts.")
        .length - 1,
    ).toBe(1);
    expect(text).toContain("Worker entrypoints do not import fastify.");
    expect(text).toContain(
      "A focused auth request would settle the hook change.",
    );
    expect(text).toContain("The base lockfile was partial.");
    expect(text).toContain("auth preHandler behavior");
    expect(text).toContain("The hook body is generated at runtime.");
    expect(text).not.toContain("internal-proof-slug");
    expect(text).toContain("Why this assessment");
    expect(text).not.toContain("PR-specific scan context was limited");
  });

  it("does not turn focus tokens into a Verify section", () => {
    const text = render(scanResultFastifyRuntime);
    expect(text).not.toMatch(/^Verify$/m);
    expect(
      scanResultFastifyRuntime.assessment?.verificationScope.focus,
    ).toEqual(expect.arrayContaining(["routes", "middleware"]));
  });
});
