import { formatCardAreaLabels } from "../../formatCardAreaLabels.js";
import {
  formatChangedPackagesShort,
  labelBlastRadiusLevel,
  labelReachabilityKind,
  labelRuntimeSurface,
} from "../../narrativePresentation.js";
import { scanSurfaceCopy } from "../../scanSurfaceCopy.js";
import {
  formatPresentationHeadline,
  formatPresentationVerification,
} from "../intent/formatPresentationCopy.js";
import type { ScanPresentationBundle } from "../orchestration/scanPresentationBundle.js";
import {
  buildNarrativeChannels,
  projectCompactKeyPoints,
  type NarrativeChannels,
} from "./narrativeChannels.js";

export {
  buildNarrativeChannels,
  projectCompactKeyPoints,
  type NarrativeChannels,
} from "./narrativeChannels.js";

function topAreaLabel(bundle: ScanPresentationBundle): string | null {
  const area = bundle.facts.affectedAreas[0];
  if (!area) return null;
  const formatted = formatCardAreaLabels([area.label], 1);
  return formatted[0] ?? area.label;
}

export function composeHeadline(bundle: ScanPresentationBundle): string {
  const { facts, profile } = bundle;
  return formatPresentationHeadline(
    profile.interpretation,
    facts,
    profile.status,
  );
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
  const { profile } = bundle;
  return formatPresentationVerification(
    profile.interpretation,
    profile.status,
    max,
  );
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

export function composeEvidenceRows(
  bundle: ScanPresentationBundle,
  max: number,
): Array<{ label: string; value: string }> {
  const { facts, profile } = bundle;
  const rows: Array<{ label: string; value: string }> = [];

  if (!profile.interpretation.suppressRuntimeNarrative) {
    const runtime = labelRuntimeSurface(facts);
    if (runtime) rows.push({ label: "Runtime", value: runtime });

    const reach = labelReachabilityKind(facts);
    if (reach) rows.push({ label: "Reachability", value: reach });
  }

  const blast = labelBlastRadiusLevel(facts);
  if (blast) rows.push({ label: "Blast radius", value: blast });

  const changed = formatChangedPackagesShort(facts, 3);
  if (changed) rows.push({ label: "Changed", value: changed });

  return rows.slice(0, max);
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
