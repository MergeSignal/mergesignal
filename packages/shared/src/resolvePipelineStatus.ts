import { type MergePosture } from "./riskVocabulary.js";

export type ScanPipelineStatus = "queued" | "running" | "done" | "failed";

export type PipelineCompletionEvidence = {
  scannedAt?: string | null;
  decision?: string | null;
  /** Denormalized or resolved PR risk score — completion signal only. */
  prRiskScore?: number | null;
  hasResult?: boolean;
};

function normalizePipelineStatus(
  status: string | undefined,
): ScanPipelineStatus {
  const st = String(status ?? "")
    .trim()
    .toLowerCase();
  if (st === "queued" || st === "running" || st === "done" || st === "failed") {
    return st;
  }
  return "failed";
}

function isMergePostureDecision(
  decision: string | null | undefined,
): decision is MergePosture {
  return (
    decision === "safe" || decision === "needs_review" || decision === "risky"
  );
}

/** Scan completion signals — decision/prRiskScore/result are set after analysis. */
export function hasScanCompletionEvidence(
  evidence: PipelineCompletionEvidence,
): boolean {
  if (isMergePostureDecision(evidence.decision)) return true;
  if (evidence.hasResult === true) return true;
  if (evidence.prRiskScore != null && Number.isFinite(evidence.prRiskScore)) {
    return true;
  }
  if (evidence.scannedAt?.trim()) return true;
  return false;
}

/**
 * Resolve wire status using completion evidence (decision, prRiskScore, result).
 * Handles races where denormalized columns are written before status flips to done.
 */
export function resolvePipelineStatus(
  status: string | undefined,
  evidence: PipelineCompletionEvidence,
): ScanPipelineStatus {
  const normalized = normalizePipelineStatus(status);
  if (normalized === "done" || normalized === "failed") return normalized;
  if (hasScanCompletionEvidence(evidence)) return "done";
  return normalized;
}
