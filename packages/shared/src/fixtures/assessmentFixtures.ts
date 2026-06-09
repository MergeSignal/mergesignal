import type { Assessment } from "../assessmentSchema.js";

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

export const assessmentTypescriptPatch: Assessment = {
  posture: "safe",
  confidence: "high",
  primaryConcern: null,
  concerns: [],
  factors: ["tooling_maintenance"],
  changeClasses: ["tooling_maintenance"],
  presentation: safeToolingPresentation,
};

export const assessmentPrettier: Assessment = {
  ...assessmentTypescriptPatch,
  factors: ["tooling_maintenance"],
};

export const assessmentEslint: Assessment = {
  ...assessmentTypescriptPatch,
};

export const assessmentVitest: Assessment = {
  posture: "safe",
  confidence: "high",
  primaryConcern: null,
  concerns: [],
  factors: ["test_infra_change"],
  changeClasses: ["test_infra"],
  presentation: safeToolingPresentation,
};

export const assessmentFastifyRuntime: Assessment = {
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
};

export const assessmentBullmq: Assessment = {
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
};

export const assessmentNextAuth: Assessment = {
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
};

export const assessmentMixedTypescriptFastify: Assessment = {
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
  changeClasses: ["runtime_upgrade", "tooling_maintenance"],
  presentation: runtimeReviewPresentation,
};

export const assessmentLimitedContext: Assessment = {
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
};

export const assessmentStub: Assessment = {
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
};

export const assessmentUnknownSafe: Assessment = {
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
};
