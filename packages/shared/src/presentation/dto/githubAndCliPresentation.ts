import type { AssessmentPresentationFields } from "./assessmentPresentationFields.js";
import type {
  PresentationConfidence,
  PresentationDensity,
  PresentationEvidenceContext,
  PresentationStatus,
} from "./types.js";

export type GitHubCheckRunPresentation = AssessmentPresentationFields & {
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

export type GitHubPrCommentPresentation = AssessmentPresentationFields & {
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

export type CliScanPresentation = AssessmentPresentationFields & {
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
    prRiskScore: number;
    prRiskBandLabel?: string;
    /** @deprecated Use prRiskScore */
    riskIndex: number;
    layerLine: string;
    findingCount: number;
    recommendationCount: number;
  };
  supportingContext?: string[];
};
