import { formatCardAreaLabels } from "../../formatCardAreaLabels.js";
import { scanSurfaceCopy } from "../../scanSurfaceCopy.js";
import type { ScanPresentationBundle } from "../orchestration/scanPresentationBundle.js";
import {
  buildNarrativeChannels,
  projectCompactKeyPoints,
} from "./narrativeChannels.js";

export {
  buildNarrativeChannels,
  projectCompactKeyPoints,
} from "./narrativeChannels.js";

function topAreaLabel(bundle: ScanPresentationBundle): string | null {
  const area = bundle.facts.affectedAreas[0];
  if (!area) return null;
  const formatted = formatCardAreaLabels([area.label], 1);
  return formatted[0] ?? area.label;
}

export function composeHeadline(bundle: ScanPresentationBundle): string {
  return buildNarrativeChannels(bundle).headline;
}

export function composeSubheadline(
  bundle: ScanPresentationBundle,
): string | undefined {
  const { profile } = bundle;
  if (profile.degradedMessage) return profile.degradedMessage;
  return undefined;
}

export function composeKeyPoints(
  bundle: ScanPresentationBundle,
  max: number,
): string[] {
  return projectCompactKeyPoints(buildNarrativeChannels(bundle), max);
}

export function composeVerificationActions(
  bundle: ScanPresentationBundle,
  max: number,
): string[] {
  return buildNarrativeChannels(bundle).verification.slice(0, max);
}

export function composeAffectedAreaLabels(
  bundle: ScanPresentationBundle,
  max: number,
): string[] {
  const labels: string[] = [];
  for (const area of bundle.facts.affectedAreas) {
    const formatted = formatCardAreaLabels([area.label], 1);
    if (formatted[0]) labels.push(formatted[0]);
    if (labels.length >= max) break;
  }
  return labels;
}

export function composeSupportingContext(
  bundle: ScanPresentationBundle,
): string[] | undefined {
  const { facts, profile, result } = bundle;

  if (profile.density === "minimal") return undefined;

  const lines: string[] = [];
  const graph = result.graphInsights;
  if (graph?.maxDepth != null) {
    lines.push(
      scanSurfaceCopy.presentation.graphDepthContext.replace(
        "{depth}",
        String(graph.maxDepth),
      ),
    );
  }
  if (graph?.nodes != null && graph?.edges != null) {
    lines.push(
      scanSurfaceCopy.presentation.graphSizeContext
        .replace("{nodes}", String(graph.nodes))
        .replace("{edges}", String(graph.edges)),
    );
  }

  return lines.length > 0 ? lines.slice(0, 3) : undefined;
}

export function evidenceContextFromProfile(bundle: ScanPresentationBundle): {
  priority: "pr_intelligence" | "limited";
  degradedMessage?: string;
} {
  return {
    priority: bundle.profile.priority,
    degradedMessage: bundle.profile.degradedMessage,
  };
}
