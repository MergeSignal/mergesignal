import type {
  PresentationConfidence,
  PresentationDensity,
  PresentationEvidenceContext,
  PresentationStatus,
} from "./types.js";
import type { FindingSeverity, ScoreLayer } from "../../types.js";

export type ScanDetailsPresentation = {
  evidenceContext: PresentationEvidenceContext;
  status: PresentationStatus;
  density: PresentationDensity;
  confidence: PresentationConfidence;

  hero: {
    headline: string;
    subheadline?: string;
    verdictLine: string;
    scopeChip?: string;
    postureLabel: string;
    riskIndex?: number | null;
  };

  narrative: {
    keyPoints: string[];
    changedPackages: string[];
    primaryPackage?: string;
  };

  usage?: {
    summary?: string;
    items: Array<{
      packageName: string;
      paths: string[];
      areas: string[];
      criticalPaths?: string[];
    }>;
    frameworks: string[];
  };

  verification: {
    actions: Array<{
      title: string;
      detail?: string;
      affectedFiles?: string[];
    }>;
  };

  signalSummary?: {
    riskIndex: number;
    band: "low" | "medium" | "high";
    layers: Array<{
      layer: ScoreLayer;
      score: number;
      band: string;
      label: string;
    }>;
  };

  operationalImpact: {
    status: "rich" | "compact" | "hidden";
    items: Array<{
      message: string;
      where?: string;
      verify?: string;
      affectedFiles?: string[];
    }>;
    fallbackMessage?: string;
  };

  recommendations: {
    items: Array<{
      rank: number;
      title: string;
      priority: "high" | "medium" | "low";
      rationale?: string;
    }>;
  };

  evidence: {
    defaultCollapsed: boolean;
    attentionAreas: Array<{
      problemLabel: string;
      problemDescription: string;
      packages: Array<{
        name: string;
        version?: string;
        direct: boolean;
        severity?: FindingSeverity;
        evidence?: string;
      }>;
      overflowCount: number;
    }>;
    findings: Array<{
      id: string;
      severity: FindingSeverity;
      title: string;
      description: string;
      packageName: string;
      recommendation?: string;
      source: "dependency" | "code";
    }>;
    findingsOverflowCount: number;
    topology?: {
      summaryLine: string;
      deepest: Array<{
        packageName: string;
        depth: number;
        direct: boolean;
        via: string[];
      }>;
    };
  };

  supportingContext?: {
    title: string;
    lines: string[];
  };

  metadata: {
    scanId: string;
    generatedAt?: string;
    methodologyVersion?: string | null;
    changedPackagesSummary?: string;
  };
};
