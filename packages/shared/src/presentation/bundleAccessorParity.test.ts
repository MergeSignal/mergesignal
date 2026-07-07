/**
 * V1 public bundle transport — ScanPresentationBundle vs contracts extractor.
 *
 * Engine OutcomePresentationBundle uses the same `extractAuthoredCommunication()`
 * from `@mergesignal/contracts`; engine-side accessor transport is covered in
 * mergesignal-engine `packages/worker/src/outcome-presentation.test.ts`.
 */

import type {
  Assessment,
  AuthoredCommunicationAccessors,
} from "@mergesignal/contracts";
import {
  extractAuthoredCommunication,
  parseAssessmentOrThrow,
} from "@mergesignal/contracts";
import { describe, expect, it } from "vitest";
import type { ScanResult } from "../types.js";
import { buildScanPresentationBundle } from "./orchestration/buildScanPresentationBundle.js";

function scanResultWith(assessment: Assessment): ScanResult {
  return {
    totalScore: 70,
    layerScores: {
      security: 70,
      maintainability: 70,
      ecosystem: 70,
      upgradeImpact: 70,
    },
    findings: [],
    generatedAt: "2026-01-01T00:00:00Z",
    changedPackages: assessment.reviewFocalPoint.anchors,
    methodologyVersion: "mergesignal-engine/test",
    assessment,
    decision: {
      recommendation: "needs_review",
      confidence: "medium",
      reasoning: [],
    },
    insights: [],
  };
}

function baseAssessment(): Assessment {
  return {
    reviewFocalPoint: {
      episodeShape: "single_anchor",
      anchors: ["pkg-a"],
      election: { grounding: [], exclusions: [] },
    },
    reachScope: { packages: ["pkg-a"], maxBucket: "moderate" },
    verificationScope: { packages: ["pkg-a"], focus: [] },
    posture: "needs_review",
    confidence: "medium",
    primaryConcern: null,
    concerns: [],
    factors: [],
    changeClasses: [],
    presentation: {
      narrativeIntensity: "standard",
      reachVisibility: "contextual",
      verificationIntensity: "advisory",
      insightEmissionFloor: "full",
      reportMode: "high_signal_pr",
    },
    reasoning: [],
    confidenceRationale: "Confidence is medium.",
  };
}

function pickAccessors(
  bundle: AuthoredCommunicationAccessors,
): AuthoredCommunicationAccessors {
  return {
    trustLine: bundle.trustLine,
    whyThisPackageLine: bundle.whyThisPackageLine,
    notAffectedLine: bundle.notAffectedLine,
    resolutionLine: bundle.resolutionLine,
    reasoningLines: [...bundle.reasoningLines],
    guidanceLines: [...bundle.guidanceLines],
    concernContextLines: [...bundle.concernContextLines],
  };
}

function assertPublicBundleMatchesContractsExtractor(
  assessment: Assessment,
  label: string,
): void {
  const normalized = parseAssessmentOrThrow(assessment);
  const expected = extractAuthoredCommunication(normalized);

  const publicBundle = buildScanPresentationBundle({
    result: scanResultWith(assessment),
    pipelineStatus: "done",
  });
  expect(publicBundle, `${label}: public bundle`).not.toBeNull();

  expect(pickAccessors(publicBundle!), label).toEqual(pickAccessors(expected));
}

describe("V1 bundle transport: public bundle matches contracts extractor", () => {
  it("cleared: identical AuthoredCommunicationAccessors", () => {
    assertPublicBundleMatchesContractsExtractor(
      {
        ...baseAssessment(),
        outcome: "cleared",
        reasoning: ["Peer dependency constraints verified."],
        notAffectedLine:
          "No repository code paths are affected by export compatibility — this dimension is outside the review scope.",
        reviewFocalPoint: {
          ...baseAssessment().reviewFocalPoint,
          electionSummary:
            "`pkg-a` was selected as the primary review anchor because it has the highest repository reach.",
        },
      },
      "cleared",
    );
  });

  it("bounded_verify: identical AuthoredCommunicationAccessors", () => {
    assertPublicBundleMatchesContractsExtractor(
      {
        ...baseAssessment(),
        outcome: "bounded_verify",
        reasoning: ["Automation stopped before all dimensions were verified."],
        verificationScope: {
          packages: ["pkg-a"],
          focus: [],
          guidance: ["Verify route handler at `src/server.ts:42`."],
        },
        resolutionLine:
          "A passing automated verification for this dimension would make this deterministic.",
        concerns: [
          {
            kind: "confirmed_runtime_usage",
            rank: 1,
            packages: ["pkg-a"],
            evidenceRefs: [],
            context: "Runtime usage: `pkg-a` — used in 3 files.",
          },
        ],
      },
      "bounded_verify",
    );
  });

  it("abstain: identical AuthoredCommunicationAccessors", () => {
    assertPublicBundleMatchesContractsExtractor(
      {
        ...baseAssessment(),
        outcome: "abstain",
        reasoning: [
          "Cannot verify `pkg-a`: package artifacts are not publicly accessible.",
        ],
        resolutionLine:
          "Granting access to `pkg-a` artifacts or publishing them would allow deterministic verification.",
        abstainReasons: [{ kind: "private_package", packageName: "pkg-a" }],
      },
      "abstain",
    );
  });
});
