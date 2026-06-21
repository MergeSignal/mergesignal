import {
  buildScanCardPresentation,
  buildScanDetailsPresentation,
  presentSurfacesIncompleteDashboardCard,
  resolvePipelineStatus,
  type ScanCardPresentationState,
  type ScanResult,
} from "@mergesignal/shared";

export function buildScanCardForApi(input: {
  pipelineStatus: string;
  decision: string | null;
  prRiskScore?: number | null;
  result: ScanResult | null;
  scannedAt?: string | null;
  presentationState?: ScanCardPresentationState;
}) {
  if (input.presentationState === "surfaces_incomplete") {
    return presentSurfacesIncompleteDashboardCard();
  }
  const prRiskScore = input.prRiskScore ?? null;
  const effectivePipeline = resolvePipelineStatus(input.pipelineStatus, {
    decision: input.decision,
    prRiskScore,
    hasResult: input.result != null,
    scannedAt: input.scannedAt,
  });

  return buildScanCardPresentation({
    pipelineStatus: effectivePipeline,
    result: input.result,
    decision: input.decision,
    prRiskScore,
  });
}

export function buildScanDetailsForApi(input: {
  scanId: string;
  pipelineStatus: string;
  decision: string | null;
  prRiskScore?: number | null;
  result: ScanResult | null;
  methodologyVersion?: string | null;
  prNumber?: number | null;
  scannedAt?: string | null;
}) {
  const prRiskScore = input.prRiskScore ?? null;
  const effectivePipeline = resolvePipelineStatus(input.pipelineStatus, {
    decision: input.decision,
    prRiskScore,
    hasResult: input.result != null,
    scannedAt: input.scannedAt,
  });

  if (!input.result || effectivePipeline !== "done") return null;

  return buildScanDetailsPresentation({
    scanId: input.scanId,
    pipelineStatus: effectivePipeline,
    result: input.result,
    methodologyVersion: input.methodologyVersion,
    prNumber: input.prNumber,
    decision: input.decision,
    prRiskScore,
  });
}

export function buildScanStatusEventPayload(input: {
  id: string;
  status: string;
  error?: string | null;
  repoId?: string | null;
  decision?: string | null;
  prRiskScore?: number | null;
  result?: ScanResult | null;
  methodologyVersion?: string | null;
  githubPrNumber?: number | null;
  scannedAt?: string | null;
}) {
  const prRiskScore = input.prRiskScore ?? null;
  const effectivePipeline = resolvePipelineStatus(input.status, {
    decision: input.decision ?? null,
    prRiskScore,
    hasResult: input.result != null,
    scannedAt: input.scannedAt ?? null,
  });

  const detailPresentation =
    input.result && effectivePipeline === "done"
      ? buildScanDetailsForApi({
          scanId: input.id,
          pipelineStatus: input.status,
          decision: input.decision ?? null,
          prRiskScore,
          result: input.result,
          methodologyVersion: input.methodologyVersion,
          prNumber: input.githubPrNumber,
          scannedAt: input.scannedAt ?? null,
        })
      : null;

  const cardPresentation = buildScanCardForApi({
    pipelineStatus: input.status,
    decision: input.decision ?? null,
    prRiskScore,
    result: input.result ?? null,
    scannedAt: input.scannedAt ?? null,
  });

  return {
    id: input.id,
    status: input.status,
    error: input.error ?? null,
    repoId: input.repoId ?? null,
    detailPresentation,
    cardPresentation,
  };
}
