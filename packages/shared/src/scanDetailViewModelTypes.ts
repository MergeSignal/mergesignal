import type { ObservationSignalFamily } from "./cardObservationCatalog.js";
import type { NarrativeAvailabilityMode } from "./scanNarrativeFacts.js";
import type { MergePosture } from "./riskVocabulary.js";
import type { FindingSeverity, ScoreLayer } from "./types.js";

export type ScanDetailOverallRiskBand = "low" | "moderate" | "high";
export type ScanDetailLayerConcernLevel = "low" | "medium" | "high";

export type ScanDetailSignalLayer = {
  layer: ScoreLayer;
  label: string;
  score: number;
  concernLevel: ScanDetailLayerConcernLevel;
  concernLabel: string;
};

export type RiskScoreGaugeModel = {
  fillPercent: number;
  band: ScanDetailOverallRiskBand;
  ariaLabel: string;
};

export type ScanDetailSignalSummary = {
  score: number;
  overallBand: ScanDetailOverallRiskBand;
  overallLabel: string;
  gauge: RiskScoreGaugeModel;
  layers: ScanDetailSignalLayer[];
};

export type RecommendationPriority = "high" | "medium" | "low";
export type GuidanceSource = "insight" | "recommendation" | "verification";

export type ScanDetailRecommendationDetail = {
  why: string;
  whyNow: string;
  signals: string[];
  affectedPackages?: {
    names: string[];
    overflowCount: number;
  };
  expectedBenefit: string;
};

export type ScanDetailRecommendation = {
  id: string;
  rank: number;
  title: string;
  priority: RecommendationPriority;
  source: GuidanceSource;
  signalFamily?: ObservationSignalFamily | null;
  detail: ScanDetailRecommendationDetail;
  proofRefs?: { findingIds?: string[] };
};

export type ScanDetailRecommendationCenter = {
  heading: string;
  defaultSelectedId: string;
  items: ScanDetailRecommendation[];
  posture: MergePosture | null;
  scanContext?: string;
};

export type ScanDetailOperationalImpactItem = {
  message: string;
  where?: string;
  verify?: string;
  affectedFiles?: string[];
};

export type ScanDetailOperationalImpact = {
  status: "rich" | "fallback" | "hidden";
  items: ScanDetailOperationalImpactItem[];
  fallbackMessage?: string;
};

export type ScanDetailVerdict = {
  posture: MergePosture | null;
  scopeChip: string | null;
  verdictLine: string;
  prLabel?: string;
  statusLabel?: string;
};

export type ScanDetailAttentionPackage = {
  name: string;
  version?: string;
  direct: boolean;
  severity?: FindingSeverity;
  evidence?: string;
};

export type ScanDetailAttentionArea = {
  problemLabel: string;
  problemDescription: string;
  packages: ScanDetailAttentionPackage[];
  overflowCount: number;
};

export type ScanDetailFindingRow = {
  id: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  packageName: string;
  recommendation?: string;
  source: "dependency" | "code";
  coveredByRecommendationRank?: number;
};

export type ScanDetailTopology = {
  summaryLine: string;
  deepest: Array<{
    packageName: string;
    depth: number;
    direct: boolean;
    via: string[];
  }>;
};

export type ScanDetailNarrativeContext = {
  mode: NarrativeAvailabilityMode;
  codeIntelligenceAvailable: boolean;
  changedPackagesDisplay: string | null;
  runtimeSurfaceLabel: string | null;
  reachabilityLabel: string | null;
  blastRadiusLabel: string | null;
  affectedAreas: string[];
  structuralOnlyDisclaimer: string | null;
  usageHighlights: string[];
  frameworks: string[];
  blastRadiusFactors: string[];
  hotspotNames: string[];
  usageContextLine: string | null;
  upgradeContextLine: string | null;
};

export type ScanDetailViewModel = {
  verdict: ScanDetailVerdict;
  signalSummary: ScanDetailSignalSummary | null;
  followUpBridgeNote: string | null;
  recommendedActions: ScanDetailRecommendationCenter;
  operationalImpact: ScanDetailOperationalImpact;
  because: { themes: string[]; confidenceCaveat?: string } | null;
  evidence: {
    attentionAreas: ScanDetailAttentionArea[];
    findings: ScanDetailFindingRow[];
    findingsOverflowCount: number;
    topology: ScanDetailTopology | null;
  } | null;
  repoContext:
    | { status: "hidden" }
    | { status: "loaded"; comparisonLine: string };
  narrativeContext: ScanDetailNarrativeContext;
  metadata: {
    scanId: string;
    generatedAt?: string;
    methodologyVersion?: string | null;
    changedPackagesSummary?: string;
    codeAnalysisTimedOut?: boolean;
    codeIntelligenceAvailable?: boolean;
  };
};
