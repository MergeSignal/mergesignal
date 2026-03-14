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

export type LockfileManager = "pnpm" | "npm";

export type ScanLockfileInput = {
  manager: LockfileManager;
  content: string;
  path?: string;
};

export type ScanRequest = {
  repoId: string;
  dependencyGraph: unknown;
  lockfile?: ScanLockfileInput;
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
  fetchedAt: string; // ISO
  latestVersion: string | null;
  latestPublishedAt: string | null; // ISO
  modifiedAt: string | null; // ISO
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
  depth: number; // 1 = direct dependency
  via?: string[]; // root -> ... -> package
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
    directAdded: number;
    directRemoved: number;
    directUpdated: number;
    packagesAdded: number;
    packagesRemoved: number;
    topDirectAdded?: string[];
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