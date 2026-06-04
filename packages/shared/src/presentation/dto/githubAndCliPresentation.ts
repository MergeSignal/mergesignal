import type {
  PresentationConfidence,
  PresentationDensity,
  PresentationEvidenceContext,
  PresentationStatus,
} from "./types.js";

export type GitHubCheckRunPresentation = {
  status: PresentationStatus;
  density: PresentationDensity;
  confidence: PresentationConfidence;
  evidenceContext: PresentationEvidenceContext;
  title: string;
  conclusion: "success" | "neutral" | "failure";
  summaryLead: string;
  sections: Array<{
    id: "why" | "actions" | "usage" | "repoContext" | "layers" | "footer";
    title?: string;
    bullets: string[];
    collapsed?: boolean;
  }>;
  detailsUrl: string;
};

export type GitHubPrCommentPresentation = {
  status: PresentationStatus;
  density: PresentationDensity;
  confidence: PresentationConfidence;
  evidenceContext: PresentationEvidenceContext;
  title: string;
  introLines: string[];
  guidanceBlocks: Array<{
    message: string;
    where?: string;
    action?: string;
  }>;
};

export type CliScanPresentation = {
  header: { repoLabel: string; methodology?: string; confidence?: string };
  status: PresentationStatus;
  density: PresentationDensity;
  confidence: PresentationConfidence;
  evidenceContext: PresentationEvidenceContext;
  headline: string;
  subheadline?: string;
  keyPoints: string[];
  verificationActions: string[];
  metrics?: {
    riskIndex: number;
    layerLine: string;
    findingCount: number;
    recommendationCount: number;
  };
  supportingContext?: string[];
};
