export type LayerScores = {
  security: number;
  maintainability: number;
  ecosystem: number;
  upgradeImpact: number;
};

export type FindingSeverity = "low" | "medium" | "high" | "critical";

export type Finding = {
  id: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  packageName: string;
  recommendation?: string;
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

export type ScanRequest = {
  repoId: string;
  dependencyGraph: unknown;
  lockfile?: ScanLockfileInput;
  repoSource?: RepoSource;
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

export type DependencyGraphInsightKind = "hidden" | "vulnerable" | "deep" | "hotspot";

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
  | 'used_breaking_changes' 
  | 'critical_path_impact' 
  | 'security_concern' 
  | 'major_version_bump' 
  | 'deprecation_warning';

export type PRInsightPriority = 'critical' | 'high' | 'medium' | 'low';

export type PRInsight = {
  type: PRInsightType;
  priority: PRInsightPriority;
  message: string;
  files?: string[];
  action: string;
  details?: Record<string, unknown>;
};

export type PRDecisionRecommendation = 'safe' | 'needs_review' | 'risky';

export type PRDecisionConfidence = 'low' | 'medium' | 'high';

export type PRDecision = {
  recommendation: PRDecisionRecommendation;
  confidence: PRDecisionConfidence;
  reasoning: string[];
};

export type ScanResult = {
  totalScore: number;
  layerScores: LayerScores;
  findings: Finding[];
  methodologyVersion?: string;
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
};

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
  | "safe_upgrade";

export type ImpactInsightSeverity = "low" | "medium" | "high";

export type ImpactInsight = {
  type: ImpactInsightType;
  severity: ImpactInsightSeverity;
  message: string;
  affectedFiles?: string[];
};

export type PRAnalysisResult = {
  decision: PRDecisionRecommendation;
  breakingChanges: BreakingChange[];
  usageImpact: UsageReport[];
  criticalPath?: CriticalPathScore;
  insights: ImpactInsight[];
  generatedAt: string;
};
