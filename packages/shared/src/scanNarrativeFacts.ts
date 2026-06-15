import type { ObservationSignalFamily } from "./cardObservationCatalog.js";
import type { MergePosture } from "./riskVocabulary.js";
import type { RiskSignals } from "./riskSignals.js";
import type { AnalysisContextWarning } from "./types.js";

export type NarrativeAvailabilityMode =
  | "pr_intelligence"
  | "insights"
  | "graph_fallback"
  | "denormalized";

export type RuntimeSurfaceKind = "runtime" | "build" | "test" | "unknown";

export type ReachabilityKind =
  | "on_runtime_paths"
  | "build_only"
  | "test_only"
  | "unreachable"
  | "unknown";

export type BlastRadiusLevel = "narrow" | "moderate" | "wide";

export type ReviewerGuidanceKind = "insight" | "finding" | "recommendation";

export type ReviewerGuidanceScope = "changed" | "all" | "unknown";

export type RepositoryContextSource = "graphInsights" | "explain" | "finding";

export type NarrativePackageUsage = {
  packageName: string;
  paths: string[];
  criticalPaths: string[];
  files: string[];
  areas: string[];
};

export type RepoIntelligenceParseStatus =
  | "ok"
  | "invalid"
  | "absent"
  | "untrusted";

export type PackageDependencyClass =
  | "runtime"
  | "tooling"
  | "test"
  | "lint"
  | "format"
  | "build"
  | "ci"
  | "unknown";

export type PackageRoleKind =
  | "typechecker"
  | "compiler"
  | "bundler"
  | "linter"
  | "formatter"
  | "test_runner"
  | "http_framework"
  | "auth"
  | "queue"
  | "orm"
  | "unknown";

export type PackageRuntimeImpact =
  | "none"
  | "possible"
  | "confirmed"
  | "unknown";

export type PackageExpectedImpact =
  | "runtime"
  | "build_time"
  | "typecheck"
  | "test_time"
  | "development_only"
  | "unknown";

export type PackageEvidenceStrength = "high" | "medium" | "low";

export type CorpusGateReason =
  | "ok"
  | "no_code_intelligence"
  | "repo_intelligence_invalid"
  | "repo_intelligence_absent";

/** Enriched affected area with proof-chain linkage (Phase 3). */
export type AffectedAreaFact = {
  id: string;
  label: string;
  packages: string[];
  findingIds: string[];
  paths: string[];
  evidenceStrength: PackageEvidenceStrength | null;
  hotspotPackages: string[];
  verificationFocus: string[];
};

export type ScanNarrativeConfidenceFacts = {
  decision: "low" | "medium" | "high" | null;
  assessment: "low" | "medium" | "high" | null;
  limitedContext: boolean;
};

/** Engine semantic projection for one changed package (wire copy only). */
export type ChangedPackageSemantics = {
  packageName: string;
  dependencyClass: PackageDependencyClass | null;
  packageRole: PackageRoleKind | null;
  runtimeImpact: PackageRuntimeImpact | null;
  expectedImpact: PackageExpectedImpact | null;
  suppressRuntimeNarrative: boolean;
  evidenceStrength: PackageEvidenceStrength | null;
  verificationFocus: string[];
  usagePathCount: number;
  usageAreaCount: number;
};

export type PackageSemanticsSummary = {
  dependencyClass: PackageDependencyClass | null;
  packageRole: PackageRoleKind | null;
  runtimeImpact: PackageRuntimeImpact | null;
  expectedImpact: PackageExpectedImpact | null;
  suppressRuntimeNarrative: boolean;
  evidenceStrength: PackageEvidenceStrength | null;
  verificationFocus: string[];
};

export type ScanNarrativeFacts = {
  availability: {
    mode: NarrativeAvailabilityMode;
    codeIntelligenceAvailable: boolean;
    tiersPresent: { tier1: boolean; tier2: boolean; tier3: boolean };
    repoIntelligenceParse: RepoIntelligenceParseStatus;
    preparationWarnings: AnalysisContextWarning[];
    corpusGateReason: CorpusGateReason;
  };

  changedPackages: {
    primary: string | null;
    others: string[];
    all: string[];
  };

  packageUsage: NarrativePackageUsage[];

  frameworks: string[];

  runtimeSurface: {
    kind: RuntimeSurfaceKind;
    evidence: { packages: string[]; paths: string[] };
  } | null;

  reachability: {
    kind: ReachabilityKind;
    evidence: { paths: string[]; frameworks: string[] };
  } | null;

  /** Primary changed package semantics (ABI 2 wire projection). */
  packageSemantics: PackageSemanticsSummary | null;

  /** Per changed package semantics for mixed-PR precedence (wire projection). */
  changedPackageSemantics: ChangedPackageSemantics[];

  blastRadius: {
    level: BlastRadiusLevel;
    changedPackageCount?: number;
    factors: string[];
  } | null;

  affectedAreas: AffectedAreaFact[];

  hotspots: Array<{
    packageName: string;
    source: "code" | "graph";
    depth?: number;
    paths: string[];
  }>;

  reviewerGuidance: Array<{
    kind: ReviewerGuidanceKind;
    id: string;
    scope: ReviewerGuidanceScope;
    priority: string;
    message: string;
    context?: string;
    remediation?: string;
    affectedFiles?: string[];
  }>;

  confidence: ScanNarrativeConfidenceFacts;

  repositoryContext: Array<{
    family: ObservationSignalFamily;
    source: RepositoryContextSource;
    refs?: { packageNames?: string[]; metric?: Record<string, number> };
  }>;

  mergePosture: MergePosture | null;
  /** @deprecated Use `riskSignals.riskIndex` — kept for frozen surface presenters. */
  riskIndex: number | null;
  riskSignals: RiskSignals | null;
};

export const EMPTY_SCAN_NARRATIVE_FACTS: ScanNarrativeFacts = {
  availability: {
    mode: "denormalized",
    codeIntelligenceAvailable: false,
    tiersPresent: { tier1: false, tier2: false, tier3: false },
    repoIntelligenceParse: "absent",
    preparationWarnings: [],
    corpusGateReason: "repo_intelligence_absent",
  },
  changedPackages: { primary: null, others: [], all: [] },
  packageUsage: [],
  frameworks: [],
  runtimeSurface: null,
  reachability: null,
  packageSemantics: null,
  changedPackageSemantics: [],
  blastRadius: null,
  affectedAreas: [],
  hotspots: [],
  reviewerGuidance: [],
  confidence: { decision: null, assessment: null, limitedContext: false },
  repositoryContext: [],
  mergePosture: null,
  riskIndex: null,
  riskSignals: null,
};

/** Derivation caps — presenters apply tighter channel limits. */
export const NARRATIVE_FACT_MAX_PATHS = 20;
export const NARRATIVE_FACT_MAX_AREAS = 12;
export const NARRATIVE_FACT_MAX_HOTSPOTS = 15;
