import type { ObservationSignalFamily } from "./cardObservationCatalog.js";
import type { MergePosture } from "./riskVocabulary.js";

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

export type ScanNarrativeFacts = {
  availability: {
    mode: NarrativeAvailabilityMode;
    codeIntelligenceAvailable: boolean;
    tiersPresent: { tier1: boolean; tier2: boolean; tier3: boolean };
    repoIntelligenceParse: RepoIntelligenceParseStatus;
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

  blastRadius: {
    level: BlastRadiusLevel;
    changedPackageCount?: number;
    factors: string[];
  } | null;

  affectedAreas: Array<{
    id: string;
    label: string;
  }>;

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

  confidence: {
    decision: "low" | "medium" | "high" | null;
  };

  repositoryContext: Array<{
    family: ObservationSignalFamily;
    source: RepositoryContextSource;
    refs?: { packageNames?: string[]; metric?: Record<string, number> };
  }>;

  mergePosture: MergePosture | null;
  riskIndex: number | null;
};

export const EMPTY_SCAN_NARRATIVE_FACTS: ScanNarrativeFacts = {
  availability: {
    mode: "denormalized",
    codeIntelligenceAvailable: false,
    tiersPresent: { tier1: false, tier2: false, tier3: false },
    repoIntelligenceParse: "absent",
  },
  changedPackages: { primary: null, others: [], all: [] },
  packageUsage: [],
  frameworks: [],
  runtimeSurface: null,
  reachability: null,
  blastRadius: null,
  affectedAreas: [],
  hotspots: [],
  reviewerGuidance: [],
  confidence: { decision: null },
  repositoryContext: [],
  mergePosture: null,
  riskIndex: null,
};

/** Derivation caps — presenters apply tighter channel limits. */
export const NARRATIVE_FACT_MAX_PATHS = 20;
export const NARRATIVE_FACT_MAX_AREAS = 12;
export const NARRATIVE_FACT_MAX_HOTSPOTS = 15;
