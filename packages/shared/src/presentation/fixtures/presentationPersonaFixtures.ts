import type { RepoIntelligence } from "../../repoIntelligenceSchema.js";
import type { ScanResult } from "../../types.js";
import {
  fixtureRepoIntelligenceFastify,
  fixtureRepoIntelligenceTypescript,
} from "../../fixtures/repoIntelligenceFixtures.js";
import { analysisPreparationWithValidRepoIntel } from "../../fixtures/repoIntelligenceTestHelpers.js";
import {
  scanResultFastifyRuntime,
  scanResultLimitedContext,
  scanResultTypescriptPatch,
} from "./scanResultFixtures.js";

const basePrep = analysisPreparationWithValidRepoIntel();

const fixtureRepoIntelligenceEslint: RepoIntelligence = {
  packages: {
    eslint: {
      runtimeSurface: "build",
      reachability: "build_only",
      runtimeImpact: "none",
      expectedImpact: "development_only",
      evidenceStrength: "medium",
      suppressRuntimeNarrative: true,
      dependencyClass: "lint",
      packageRole: "linter",
      verificationFocus: ["ci", "lint"],
      usage: { packageName: "eslint", files: [".eslintrc.cjs"], paths: [] },
    },
  },
  blastRadius: { level: "narrow", changedPackageCount: 1 },
  applicationAreas: [],
};

const fixtureRepoIntelligencePrettier: RepoIntelligence = {
  packages: {
    prettier: {
      runtimeSurface: "build",
      reachability: "build_only",
      runtimeImpact: "none",
      expectedImpact: "development_only",
      evidenceStrength: "medium",
      suppressRuntimeNarrative: true,
      dependencyClass: "format",
      packageRole: "formatter",
      verificationFocus: ["ci", "format"],
      usage: { packageName: "prettier", files: [".prettierrc"], paths: [] },
    },
  },
  blastRadius: { level: "narrow", changedPackageCount: 1 },
  applicationAreas: [],
};

const fixtureRepoIntelligenceVitest: RepoIntelligence = {
  packages: {
    vitest: {
      runtimeSurface: "test",
      reachability: "test_only",
      runtimeImpact: "none",
      expectedImpact: "test_time",
      evidenceStrength: "medium",
      suppressRuntimeNarrative: true,
      dependencyClass: "test",
      packageRole: "test_runner",
      verificationFocus: ["ci", "test_suite"],
      usage: { packageName: "vitest", files: ["vitest.config.ts"], paths: [] },
    },
  },
  blastRadius: { level: "narrow", changedPackageCount: 1 },
  applicationAreas: [],
};

const fixtureRepoIntelligenceNextAuth: RepoIntelligence = {
  packages: {
    "next-auth": {
      runtimeSurface: "runtime",
      reachability: "on_runtime_paths",
      runtimeImpact: "confirmed",
      expectedImpact: "runtime",
      evidenceStrength: "high",
      suppressRuntimeNarrative: false,
      dependencyClass: "runtime",
      packageRole: "auth",
      verificationFocus: ["auth_flow", "session", "routes"],
      usage: {
        packageName: "next-auth",
        files: ["apps/web/src/auth.ts"],
        paths: ["apps/web/src/auth.ts"],
        areas: ["Auth"],
      },
    },
  },
  blastRadius: { level: "moderate", changedPackageCount: 1 },
  applicationAreas: [{ id: "auth", label: "authentication flows" }],
};

const fixtureRepoIntelligenceBullmq: RepoIntelligence = {
  packages: {
    bullmq: {
      runtimeSurface: "runtime",
      reachability: "on_runtime_paths",
      runtimeImpact: "confirmed",
      expectedImpact: "runtime",
      evidenceStrength: "high",
      suppressRuntimeNarrative: false,
      dependencyClass: "runtime",
      packageRole: "queue",
      verificationFocus: ["workers", "queue", "serialization"],
      usage: {
        packageName: "bullmq",
        files: ["apps/worker/src/queue.ts"],
        paths: ["apps/worker/src/queue.ts"],
        areas: ["Workers"],
      },
    },
  },
  blastRadius: { level: "moderate", changedPackageCount: 1 },
  applicationAreas: [{ id: "workers", label: "background job processing" }],
};

const fixtureRepoIntelligenceUnknown: RepoIntelligence = {
  packages: {
    "opaque-pkg": {
      runtimeSurface: "unknown",
      reachability: "unknown",
      runtimeImpact: "unknown",
      expectedImpact: "unknown",
      evidenceStrength: "low",
      suppressRuntimeNarrative: false,
      dependencyClass: "unknown",
      packageRole: "unknown",
      verificationFocus: [],
      usage: { packageName: "opaque-pkg", files: [], paths: [] },
    },
  },
  blastRadius: { level: "narrow", changedPackageCount: 1 },
  applicationAreas: [],
};

const fixtureRepoIntelligenceMixedToolingRuntime: RepoIntelligence = {
  packages: {
    typescript: fixtureRepoIntelligenceTypescript.packages.typescript!,
    fastify: fixtureRepoIntelligenceFastify.packages.fastify!,
  },
  blastRadius: fixtureRepoIntelligenceFastify.blastRadius,
  applicationAreas: fixtureRepoIntelligenceFastify.applicationAreas,
};

function scanBase(over: Partial<ScanResult> = {}): ScanResult {
  return {
    totalScore: 18,
    layerScores: {
      security: 5,
      maintainability: 8,
      ecosystem: 10,
      upgradeImpact: 5,
    },
    findings: [],
    generatedAt: "2026-01-01T00:00:00.000Z",
    decision: {
      recommendation: "safe",
      confidence: "high",
      reasoning: [],
    },
    analysisPreparation: basePrep,
    ...over,
  };
}

export const scanResultEslint: ScanResult = scanBase({
  changedPackages: ["eslint"],
  repoIntelligence: fixtureRepoIntelligenceEslint,
});

export const scanResultPrettier: ScanResult = scanBase({
  changedPackages: ["prettier"],
  repoIntelligence: fixtureRepoIntelligencePrettier,
});

export const scanResultVitest: ScanResult = scanBase({
  changedPackages: ["vitest"],
  repoIntelligence: fixtureRepoIntelligenceVitest,
});

export const scanResultNextAuth: ScanResult = scanBase({
  totalScore: 52,
  changedPackages: ["next-auth"],
  repoIntelligence: fixtureRepoIntelligenceNextAuth,
  decision: {
    recommendation: "needs_review",
    confidence: "medium",
    reasoning: [],
  },
});

export const scanResultBullmq: ScanResult = scanBase({
  totalScore: 48,
  changedPackages: ["bullmq"],
  repoIntelligence: fixtureRepoIntelligenceBullmq,
  decision: {
    recommendation: "needs_review",
    confidence: "medium",
    reasoning: [],
  },
});

export const scanResultUnknownSafe: ScanResult = scanBase({
  changedPackages: ["opaque-pkg"],
  repoIntelligence: fixtureRepoIntelligenceUnknown,
});

export const scanResultMixedTypescriptFastify: ScanResult = scanBase({
  totalScore: 55,
  changedPackages: ["typescript", "fastify"],
  repoIntelligence: fixtureRepoIntelligenceMixedToolingRuntime,
  decision: {
    recommendation: "needs_review",
    confidence: "medium",
    reasoning: [],
  },
});

export {
  scanResultFastifyRuntime,
  scanResultLimitedContext,
  scanResultTypescriptPatch,
};
