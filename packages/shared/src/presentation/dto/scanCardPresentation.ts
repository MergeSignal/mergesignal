import type {
  FindingCountSummary,
  PresentationConfidence,
  PresentationDensity,
  PresentationEvidenceContext,
  PresentationEvidenceRow,
  PresentationStatus,
} from "./types.js";

export type ScanCardPresentation = {
  pipeline?: {
    status: "queued" | "running" | "failed";
    headline: string;
    subheadline?: string;
  };

  status?: PresentationStatus;
  density?: PresentationDensity;
  confidence?: PresentationConfidence;
  evidenceContext?: PresentationEvidenceContext;
  headline: string;
  subheadline?: string;

  changedPackages: string[];
  primaryPackage?: string;

  keyPoints: string[];
  affectedAreas: string[];
  verificationActions: string[];
  evidence: PresentationEvidenceRow[];

  supportingContext?: string[];

  riskIndex?: number | null;
  findingCounts?: FindingCountSummary | null;
  actionLabel?: string;
};
