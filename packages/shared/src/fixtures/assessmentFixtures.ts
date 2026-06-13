import type { Assessment } from "../assessmentSchema.js";
import {
  emptyReachScope,
  emptyVerificationScope,
  minimalReviewFocalPoint,
  reachScopeFor,
  verificationScopeFor,
  withAssessmentScope,
} from "./assessmentScopeFixtures.js";

const safeToolingPresentation: Assessment["presentation"] = {
  narrativeIntensity: "minimal",
  reachVisibility: "hidden",
  verificationIntensity: "advisory",
  insightEmissionFloor: "none",
  reportMode: "high_signal_pr",
};

const runtimeReviewPresentation: Assessment["presentation"] = {
  narrativeIntensity: "elevated",
  reachVisibility: "prominent",
  verificationIntensity: "required",
  insightEmissionFloor: "full",
  reportMode: "high_signal_pr",
};

export const assessmentTypescriptPatch: Assessment = withAssessmentScope(
  {
    posture: "safe",
    confidence: "high",
    primaryConcern: null,
    concerns: [],
    factors: ["tooling_maintenance"],
    changeClasses: ["tooling_maintenance"],
    presentation: safeToolingPresentation,
  },
  {
    reviewFocalPoint: minimalReviewFocalPoint(["typescript"]),
    reachScope: emptyReachScope(),
    verificationScope: emptyVerificationScope(),
  },
);

export const assessmentPrettier: Assessment = withAssessmentScope(
  {
    ...assessmentTypescriptPatch,
    factors: ["tooling_maintenance"],
  },
  {
    reviewFocalPoint: minimalReviewFocalPoint(["prettier"]),
    reachScope: emptyReachScope(),
    verificationScope: emptyVerificationScope(),
  },
);

export const assessmentEslint: Assessment = withAssessmentScope(
  {
    ...assessmentTypescriptPatch,
  },
  {
    reviewFocalPoint: minimalReviewFocalPoint(["eslint"]),
    reachScope: emptyReachScope(),
    verificationScope: emptyVerificationScope(),
  },
);

export const assessmentVitest: Assessment = withAssessmentScope(
  {
    posture: "safe",
    confidence: "high",
    primaryConcern: null,
    concerns: [],
    factors: ["test_infra_change"],
    changeClasses: ["test_infra"],
    presentation: safeToolingPresentation,
  },
  {
    reviewFocalPoint: minimalReviewFocalPoint(["vitest"]),
    reachScope: emptyReachScope(),
    verificationScope: emptyVerificationScope(),
  },
);

export const assessmentFastifyRuntime: Assessment = withAssessmentScope(
  {
    posture: "needs_review",
    confidence: "medium",
    primaryConcern: "confirmed_runtime_usage",
    concerns: [
      {
        kind: "confirmed_runtime_usage",
        rank: 1,
        packages: ["fastify"],
        evidenceRefs: ["fixture:fastify"],
      },
    ],
    factors: ["confirmed_runtime_usage", "http_framework_infrastructure"],
    changeClasses: ["runtime_upgrade"],
    presentation: runtimeReviewPresentation,
  },
  {
    reviewFocalPoint: minimalReviewFocalPoint(["fastify"]),
    reachScope: reachScopeFor(["fastify"]),
    verificationScope: verificationScopeFor(
      ["fastify"],
      ["routes", "middleware"],
    ),
  },
);

export const assessmentBullmq: Assessment = withAssessmentScope(
  {
    posture: "needs_review",
    confidence: "medium",
    primaryConcern: "confirmed_runtime_usage",
    concerns: [
      {
        kind: "confirmed_runtime_usage",
        rank: 1,
        packages: ["bullmq"],
        evidenceRefs: ["fixture:bullmq"],
      },
    ],
    factors: [
      "confirmed_runtime_usage",
      "queue_infrastructure",
      "verification_required",
    ],
    changeClasses: ["runtime_upgrade"],
    presentation: runtimeReviewPresentation,
  },
  {
    reviewFocalPoint: minimalReviewFocalPoint(["bullmq"]),
    reachScope: reachScopeFor(["bullmq"]),
    verificationScope: verificationScopeFor(
      ["bullmq"],
      ["workers", "queue", "serialization"],
    ),
  },
);

export const assessmentNextAuth: Assessment = withAssessmentScope(
  {
    posture: "needs_review",
    confidence: "medium",
    primaryConcern: "confirmed_runtime_usage",
    concerns: [
      {
        kind: "confirmed_runtime_usage",
        rank: 1,
        packages: ["next-auth"],
        evidenceRefs: ["fixture:nextauth"],
      },
    ],
    factors: ["confirmed_runtime_usage", "auth_infrastructure"],
    changeClasses: ["runtime_upgrade"],
    presentation: runtimeReviewPresentation,
  },
  {
    reviewFocalPoint: minimalReviewFocalPoint(["next-auth"]),
    reachScope: reachScopeFor(["next-auth"]),
    verificationScope: verificationScopeFor(
      ["next-auth"],
      ["auth_flow", "session", "routes"],
    ),
  },
);

/** PR #26 — focal fastify despite typescript in changedPackages order. */
export const assessmentMixedTypescriptFastify: Assessment = withAssessmentScope(
  {
    posture: "needs_review",
    confidence: "medium",
    primaryConcern: "confirmed_runtime_usage",
    concerns: [
      {
        kind: "confirmed_runtime_usage",
        rank: 1,
        packages: ["fastify"],
        evidenceRefs: ["fixture:fastify"],
      },
    ],
    factors: [
      "confirmed_runtime_usage",
      "queue_infrastructure",
      "http_framework_infrastructure",
    ],
    changeClasses: ["runtime_upgrade", "tooling_maintenance"],
    presentation: runtimeReviewPresentation,
  },
  {
    reviewFocalPoint: minimalReviewFocalPoint(["fastify"], {
      episodeShape: "parent_supporting",
      supportingPackages: ["bullmq", "next-auth"],
    }),
    reachScope: reachScopeFor(["bullmq", "fastify", "next-auth"]),
    verificationScope: verificationScopeFor(
      ["bullmq", "fastify", "next-auth"],
      ["workers", "queue", "routes", "middleware"],
    ),
  },
);

export const assessmentLimitedContext: Assessment = withAssessmentScope(
  {
    posture: "needs_review",
    confidence: "low",
    primaryConcern: "insufficient_evidence",
    concerns: [
      {
        kind: "insufficient_evidence",
        rank: 1,
        evidenceRefs: ["fixture:limited"],
      },
    ],
    factors: ["insufficient_collection_evidence"],
    changeClasses: ["ecosystem_unknown"],
    presentation: {
      narrativeIntensity: "minimal",
      reachVisibility: "hidden",
      verificationIntensity: "none",
      insightEmissionFloor: "none",
      reportMode: "high_signal_pr",
    },
  },
  {
    reviewFocalPoint: minimalReviewFocalPoint(["lodash"]),
    reachScope: emptyReachScope(),
    verificationScope: emptyVerificationScope(),
  },
);

export const assessmentStub: Assessment = withAssessmentScope(
  {
    posture: "needs_review",
    confidence: "low",
    primaryConcern: "insufficient_evidence",
    concerns: [
      {
        kind: "insufficient_evidence",
        rank: 1,
        evidenceRefs: ["stub:engine"],
      },
    ],
    factors: ["insufficient_collection_evidence"],
    changeClasses: ["ecosystem_unknown"],
    presentation: {
      narrativeIntensity: "minimal",
      reachVisibility: "hidden",
      verificationIntensity: "none",
      insightEmissionFloor: "none",
      reportMode: "high_signal_pr",
    },
  },
  {
    reviewFocalPoint: minimalReviewFocalPoint(["dependency_graph"], {
      episodeShape: "structural",
    }),
    reachScope: emptyReachScope(),
    verificationScope: emptyVerificationScope(),
  },
);

export const assessmentUnknownSafe: Assessment = withAssessmentScope(
  {
    posture: "safe",
    confidence: "medium",
    primaryConcern: null,
    concerns: [],
    factors: ["ecosystem_unknown_package"],
    changeClasses: ["ecosystem_unknown"],
    presentation: {
      narrativeIntensity: "standard",
      reachVisibility: "contextual",
      verificationIntensity: "advisory",
      insightEmissionFloor: "explain_only",
      reportMode: "high_signal_pr",
    },
  },
  {
    reviewFocalPoint: minimalReviewFocalPoint(["opaque-pkg"]),
    reachScope: emptyReachScope(),
    verificationScope: emptyVerificationScope(),
  },
);

export {
  emptyReachScope,
  emptyVerificationScope,
  minimalReviewFocalPoint,
  reachScopeFor,
  verificationScopeFor,
  withAssessmentScope,
} from "./assessmentScopeFixtures.js";
