import type { Assessment } from "@mergesignal/contracts";

export type LayerScores = {
  security: number;
  maintainability: number;
  ecosystem: number;
  upgradeImpact: number;
};

/** Engine-emitted PR-scoped risk score (ABI 4+). */
export type PrRiskWire = {
  score: number;
  layerScores?: LayerScores;
};

/** Engine-emitted repository health score (ABI 4+). */
export type RepositoryHealthWire = {
  totalScore: number;
  layerScores?: LayerScores;
};

export type FindingSeverity = "low" | "medium" | "high" | "critical";

/**
 * Producer-authored classification for {@link Finding}. Prefer this over inferring from `id` strings.
 */
export type FindingCategory =
  | "graph_structure"
  | "input_coverage"
  | "security_vulnerability"
  | "ecosystem_registry"
  | "ecosystem_adoption"
  | "ecosystem_github"
  | "breaking_change"
  | "deprecation"
  | "major_version"
  | "unknown";

/** Structured lockfile delta (optional; from worker base vs head comparison). */
export type LockfilePackageDelta = {
  added: string[];
  removed: string[];
  /** Package names whose resolved version changed between base and head. */
  updated: string[];
};

export type Finding = {
  id: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  packageName: string;
  recommendation?: string;
  /** When set, drives insight-layer mapping; omit only for external/legacy fixtures. */
  category?: FindingCategory;
  /** Optional structured hints (e.g. OSV ids); omit if public contract forbids extra keys. */
  evidence?: Record<string, unknown>;
};

export type LockfileManager = "pnpm" | "npm" | "yarn";

export type ScanLockfileInput = {
  manager: LockfileManager;
  content: string;
  path?: string;
};

export type RepoSource = {
  provider: "github";
  owner: string;
  repo: string;
  sha: string;
  installationId: number;
};

export type CodeAnalysisMetrics = {
  fromCache: boolean;
  analysisTimeMs?: number;
  timedOut?: boolean;
  filesAnalyzed: number;
};

/** In-memory corpus passed as the second argument to engine `analyze()`. */
export type CodeAnalysisInput = {
  fileContents: Map<string, string>;
  changedPackages: string[];
};

export type AnalysisContextWarningCode =
  | "lockfile_diff_skipped"
  | "lockfile_diff_failed"
  | "lockfile_diff_empty"
  | "base_lockfile_missing"
  | "code_fetch_skipped"
  | "code_fetch_failed"
  | "code_fetch_auth_failure"
  | "code_fetch_timeout"
  | "code_fetch_rate_limit"
  | "code_corpus_empty"
  | "repo_intelligence_contract_invalid"
  | "package_change_ingress_rejected"
  | "package_change_code_analysis_dropped"
  | "package_change_ambiguous_transition";

export type AnalysisContextWarning = {
  code: AnalysisContextWarningCode;
  message: string;
  details?: Record<string, unknown>;
};

export type RepoIntelligenceValidationStatus = "valid" | "invalid" | "absent";

export type RepoIntelligenceValidation = {
  status: RepoIntelligenceValidationStatus;
  abi: string;
  issueCount?: number;
  representativeIssues?: string[];
  validatedAt: string;
};

/** Worker-authored diagnostics merged onto persisted ScanResult when corpus unavailable. */
export type AnalysisPreparation = {
  codeIntelligenceAvailable: boolean;
  warnings: AnalysisContextWarning[];
  repoIntelligenceValidation?: RepoIntelligenceValidation;
};

/** Subset of PR identity passed into analysis (no installation tokens). */
export type ScanRequestGithubContext = {
  owner: string;
  repo: string;
  prNumber: number;
};

export type ScanRequest = {
  repoId: string;
  dependencyGraph: unknown;
  lockfile?: ScanLockfileInput;
  /** Base branch lockfile for PR scans (optional). */
  baseLockfile?: ScanLockfileInput;
  repoSource?: RepoSource;
  /** Optional PR context for engine/logging (no installation id). */
  github?: ScanRequestGithubContext;
  changedPackages?: string[];
  /** When both base and head lockfiles were compared in the worker. */
  lockfilePackageDelta?: LockfilePackageDelta;
  changedFiles?: string[];
  codeAnalysisMetrics?: CodeAnalysisMetrics;
};

export type ScoreLayer = keyof LayerScores;

export type RiskConfidence = "low" | "medium" | "high";

export type RiskSignal = {
  id: string;
  layer: ScoreLayer;
  name: string;
  value: number;
  weight: number;
  scoreImpact: number;
  evidence?: Record<string, unknown>;
};

export type ScoreContribution = {
  id: string;
  layer: ScoreLayer;
  scoreImpact: number;
  evidence?: Record<string, unknown>;
};

export type Recommendation = {
  id: string;
  title: string;
  rationale: string;
  impact: "low" | "medium" | "high";
  packages?: string[];
  rank?: number;
  priorityScore?: number;
  estimatedScoreDelta?: number;
  layers?: ScoreLayer[];
  evidence?: Record<string, unknown>;
};

export type PackageHealthObservation = {
  name: string;
  registry: "npm";
  fetchedAt: string;
  latestVersion: string | null;
  latestPublishedAt: string | null;
  modifiedAt: string | null;
  deprecated: boolean;
  maintainersCount: number | null;
  repositoryUrl: string | null;
};

export type ScanDataset = {
  packageHealth?: PackageHealthObservation[];
};

export type ExplainReason = {
  id: string;
  layer: ScoreLayer;
  title: string;
  value?: number;
  scoreImpact: number;
  evidence?: Record<string, unknown>;
};

export type ExplainBlock = {
  reasons: ExplainReason[];
};

export type DependencyGraphInsightKind =
  | "hidden"
  | "vulnerable"
  | "deep"
  | "hotspot";

export type DependencyGraphInsight = {
  kind: DependencyGraphInsightKind;
  packageName: string;
  version?: string;
  direct: boolean;
  depth: number;
  via?: string[];
  evidence?: Record<string, unknown>;
};

export type DependencyGraphInsights = {
  maxDepth: number;
  nodes: number;
  edges: number;
  deepest?: DependencyGraphInsight[];
  hotspots?: DependencyGraphInsight[];
  vulnerable?: DependencyGraphInsight[];
};

export type PRInsightType =
  | "behavioral_change"
  | "usage_risk"
  | "dependency_risk"
  | "hot_path_impact"
  | "complexity_creep";

export type PRInsightPriority = "critical" | "high" | "medium";

export type InsightConfidence = "confirmed" | "likely" | "speculative";
export type InsightScope = "changed" | "all";

/** PR-facing merge decision vocabulary per insight (emitted insights use RISKY | BLOCK only). */
export type InsightDecisionLevel = "SAFE" | "RISKY" | "BLOCK";

/** Bar for whether an insight may appear on a PR (strict gate: only `high` emits). */
export type EmissionConfidenceLevel = "low" | "medium" | "high";

/**
 * Per-repo threshold controlling which emission confidence levels trigger a PR comment.
 * - `'high'`   → only `emissionConfidence === 'high'` (default; free tier)
 * - `'medium'` → `'high' | 'medium'` (paid tier opt-in)
 * - `'low'`    → all confidence levels (reserved; no analyzer produces low-confidence today)
 */
export type CommentThreshold = "high" | "medium" | "low";

export type PRInsight = {
  type: PRInsightType;
  priority: PRInsightPriority;
  confidence: InsightConfidence;
  scope: InsightScope;
  message: string;
  context: string;
  remediation: string;
  affectedFiles?: string[];
  details?: Record<string, unknown>;
  /**
   * Decision-first contract. Optional on analyzer drafts; required on {@link PRInsightEmission}.
   */
  decisionLevel?: InsightDecisionLevel;
  emissionConfidence?: EmissionConfidenceLevel;
  mechanism?: string;
  action?: string;
};

/** Insights returned from `analyze()` after synthesis + emission contract. */
export type PRInsightEmission = PRInsight & {
  decisionLevel: InsightDecisionLevel;
  emissionConfidence: EmissionConfidenceLevel;
  mechanism: string;
  action: string;
};

/**
 * Canonical merge posture tokens for `ScanResult.decision.recommendation` and
 * persisted/API `decision` fields. Analysis engines must emit **only** these
 * lowercase strings (no alternate vocabularies in the wire contract).
 */
export const MERGE_POSTURE_RECOMMENDATIONS = [
  "safe",
  "needs_review",
  "risky",
] as const;

export type PRDecisionRecommendation =
  (typeof MERGE_POSTURE_RECOMMENDATIONS)[number];

export type PRDecisionConfidence = "low" | "medium" | "high";

export type PRDecision = {
  recommendation: PRDecisionRecommendation;
  confidence: PRDecisionConfidence;
  reasoning: string[];
};

/** Presentation-only: how the engine surfaces results when PR-local signal is weak vs strong. */
export type ReportPresentationMode =
  | "high_signal_pr"
  | "lightweight_pr_graph_baseline";

export type ReportPresentation = {
  mode: ReportPresentationMode;
};

/**
 * Optional bounded engineering trace for `MERGESIGNAL_ENGINEERING_TRACE=1`.
 * Not end-user telemetry; deterministic, size-capped, for debugging narrative/emission ordering.
 */
export type EngineeringTrace = {
  narrativeProfileSnapshot: {
    dominantKind: string;
    dominantTuple: readonly [number, number, number];
    runnerUpKind: string | null;
    decidedAtStep: string;
    marginApplied: boolean;
    prChangedPackages: readonly string[];
  };
  explainDriverIds: readonly string[];
  orderingTrace: readonly {
    messagePreview: string;
    narrativeTier: number;
    qualityPass: boolean;
    priority: PRInsightPriority;
    type: PRInsightType;
  }[];
  emissionDrops: readonly { ruleId: string }[];
  analyzerContributions: Readonly<Record<string, number>>;
};

export type ScanResult = {
  /** Legacy composite score — historical fallback only; not PR Risk authority on ABI-4 output. */
  totalScore: number;
  layerScores: LayerScores;
  /** PR Risk authority on ABI-4 engine output. */
  prRisk?: PrRiskWire;
  /** Repository health authority on ABI-4 engine output. */
  repositoryHealth?: RepositoryHealthWire;
  findings: Finding[];
  methodologyVersion?: string;
  /** Assessment Contract — sole authority for posture and presentation intensity. */
  assessment?: Assessment;
  confidence?: RiskConfidence;
  signals?: RiskSignal[];
  contributions?: ScoreContribution[];
  recommendations?: Recommendation[];
  dataset?: ScanDataset;
  explain?: ExplainBlock;
  graphInsights?: DependencyGraphInsights;
  generatedAt: string;
  insights?: PRInsight[];
  decision?: PRDecision;
  codeAnalysisMetrics?: CodeAnalysisMetrics;
  /** Present when `MERGESIGNAL_ENGINEERING_TRACE=1` during analysis (bounded, deterministic). */
  engineeringTrace?: EngineeringTrace;
  /**
   * Binary presentation policy (fallback vs high-signal). Does not drive analyzer or scoring logic.
   */
  reportPresentation?: ReportPresentation;
  /** Echo of `ScanRequest.changedPackages` when non-empty (e.g. lockfile diff); for Check Run / UI copy. */
  changedPackages?: string[];
  /**
   * Raw engine-emitted repository intelligence (valid or invalid wire).
   * Consumers must use `analysisPreparation.repoIntelligenceValidation` + {@link safeParseRepoIntelligence}.
   */
  repoIntelligence?: unknown;
  /** Worker merge: preparation diagnostics (code corpus availability). */
  analysisPreparation?: AnalysisPreparation;
};

/** Provenance the analysis engine must set on fresh output (historical DB rows may omit methodology). */
export type ScanProvenanceFields = Pick<
  ScanResult,
  "methodologyVersion" | "generatedAt"
>;

/** Result that passed strict engine-output validation (non-empty methodology). */
export type EngineEmittedScanResult = ScanResult &
  Required<Pick<ScanResult, "methodologyVersion">>;

export type UpgradeTarget = {
  packageName: string;
  targetVersion?: string;
};

export type UpgradeSimulationRequest = {
  repoId: string;
  currentLockfile: ScanLockfileInput;
  proposedLockfile?: ScanLockfileInput;
  target?: UpgradeTarget;
};

export type UpgradeSimulationDelta = {
  totalScoreDelta?: number;
  layerScoreDeltas?: Partial<Record<ScoreLayer, number>>;
  topSignalDeltas?: Array<{
    id: string;
    layer: ScoreLayer;
    before?: number;
    after?: number;
    scoreImpactBefore?: number;
    scoreImpactAfter?: number;
  }>;
  dependencyDelta?: {
    directKnown?: boolean;
    directAdded: number;
    directRemoved: number;
    directUpdated: number;
    packagesAdded: number;
    packagesRemoved: number;
    topDirectAdded?: string[];
    topDirectRemoved?: string[];
    topDirectUpdated?: string[];
  };
};

export type UpgradeSimulationImpact = {
  packageName?: string;
  observedVersions?: string[];
  fanIn?: number;
  rootBlastRadius?: number;
};

export type UpgradeSimulationResult = {
  before: ScanResult;
  after?: ScanResult;
  delta?: UpgradeSimulationDelta;
  impact?: UpgradeSimulationImpact;
  generatedAt: string;
};

export type BreakingChangeSource = "semver" | "changelog" | "manual";

export type BreakingChangeSeverity = "low" | "medium" | "high";

export type BreakingChange = {
  source: BreakingChangeSource;
  severity: BreakingChangeSeverity;
  description: string;
  affectedAPIs?: string[];
};

export type UsageReport = {
  filesUsingPackage: string[];
  importedSymbols: string[];
  criticalPaths: string[];
  usageCount: number;
};

export type CriticalPathScore = {
  isCritical: boolean;
  score: number;
  reasons: string[];
};

export type ImpactInsightType =
  | "breaking_change_used"
  | "breaking_change_unused"
  | "critical_path_affected"
  | "high_usage_detected"
  | "safe_upgrade";

export type ImpactInsightSeverity = "low" | "medium" | "high";

export type ImpactInsight = {
  type: ImpactInsightType;
  severity: ImpactInsightSeverity;
  message: string;
  affectedFiles?: string[];
  affectedSymbols?: string[];
  breakingChange?: BreakingChange;
};

export type PRAnalysisResult = {
  decision: PRDecisionRecommendation;
  breakingChanges: BreakingChange[];
  usageImpact: UsageReport[];
  criticalPath?: CriticalPathScore;
  insights: ImpactInsight[];
  generatedAt: string;
};

/** BullMQ queue name shared by API (producer) and worker (consumer). */
export const SCAN_QUEUE_NAME = "scan-queue" as const;

export type ScanQueueGithubContext = {
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
  baseSha?: string;
  baseRef?: string;
  installationId: number;
  deliveryId?: string;
};

/** BullMQ job payload for scan jobs. */
export type ScanQueueJob = {
  scanId: string;
  repoId: string;
  dependencyGraph: unknown;
  lockfile?: ScanLockfileInput;
  baseLockfile?: ScanLockfileInput;
  repoSource?: RepoSource;
  changedFiles?: string[];
  /** PR manifest paths (package.json) for importer-scoped lockfile diff. */
  changedPackageJsonFiles?: string[];
  github?: ScanQueueGithubContext;
};
