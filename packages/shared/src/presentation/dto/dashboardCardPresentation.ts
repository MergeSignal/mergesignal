import type { AssessmentPresentationFields } from "./assessmentPresentationFields.js";
import type { PresentationEvidenceRow, PresentationStatus } from "./types.js";

export type DashboardCardLayout = "quiet" | "standard" | "expanded";

export type DashboardCardPresentation =
  Partial<AssessmentPresentationFields> & {
    verdict?: {
      posture: PresentationStatus;
      postureLabel: string;
      scopeLabel?: string;
    };

    headline: string;

    pipeline?: {
      status: "queued" | "running" | "failed";
      headline: string;
      subheadline?: string;
    };

    limitedContext?: {
      message: string;
    };

    insights: string[];
    scopeAreas?: string[];
    verification: string[];
    evidenceChips?: PresentationEvidenceRow[];

    layout: DashboardCardLayout;
    detailActionLabel: string;

    sortKey: {
      postureRank: number;
      riskIndex: number;
    };
  };
