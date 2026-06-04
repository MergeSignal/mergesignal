import { scanSurfaceCopy } from "../../scanSurfaceCopy.js";
import {
  normalizeGeneratedText,
  normalizeGeneratedTextNullable,
} from "../../normalizeGeneratedText.js";
import type { ScanCardPresentation } from "../dto/scanCardPresentation.js";

export function presentPipelineScanCard(
  pipelineStatus: "queued" | "running" | "failed",
): ScanCardPresentation {
  const isRunning = pipelineStatus === "queued" || pipelineStatus === "running";
  const headline = isRunning
    ? scanSurfaceCopy.pipeline.scanRunning
    : scanSurfaceCopy.pipeline.analysisIncomplete;

  return {
    pipeline: {
      status: pipelineStatus,
      headline: normalizeGeneratedText(headline),
      subheadline: isRunning
        ? scanSurfaceCopy.pipeline.scanIncomplete
        : undefined,
    },
    headline: normalizeGeneratedText(headline),
    changedPackages: [],
    keyPoints: [],
    affectedAreas: [],
    verificationActions: [],
    evidence: [],
  };
}
