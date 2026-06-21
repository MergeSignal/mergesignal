import { scanSurfaceCopy } from "../../scanSurfaceCopy.js";
import type { CliScanPresentation } from "../dto/githubAndCliPresentation.js";

export function renderCliScanSummaryText(p: CliScanPresentation): string {
  const lines: string[] = [
    `MergeSignal - ${p.header.repoLabel}`,
    "",
    p.headline,
  ];
  if (p.subheadline) lines.push(p.subheadline);
  lines.push(
    "",
    `Status: ${p.status} | Density: ${p.density} | Confidence: ${p.confidence}`,
  );
  if (p.metrics) {
    const bandSuffix = p.metrics.prRiskBandLabel
      ? ` (${p.metrics.prRiskBandLabel})`
      : "";
    lines.push(
      `${scanSurfaceCopy.actions.prRiskScoreLabel}: ${p.metrics.prRiskScore}${bandSuffix}`,
      p.metrics.layerLine,
      `Findings: ${p.metrics.findingCount} | Recommendations: ${p.metrics.recommendationCount}`,
    );
  }
  if (p.keyPoints.length > 0) {
    lines.push("", "Key points:");
    for (const point of p.keyPoints) lines.push(`  - ${point}`);
  }
  if (p.verificationActions.length > 0) {
    lines.push("", "Verify:");
    for (const action of p.verificationActions) lines.push(`  - ${action}`);
  }
  if (p.supportingContext?.length) {
    lines.push("", "Supporting context:");
    for (const line of p.supportingContext) lines.push(`  - ${line}`);
  }
  return lines.join("\n");
}
