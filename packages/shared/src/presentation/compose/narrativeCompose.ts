import { formatCardAreaLabels } from "../../formatCardAreaLabels.js";
import {
  composeVerificationPrompt,
  formatChangedPackagesShort,
  labelBlastRadiusLevel,
  labelReachabilityKind,
  labelRuntimeSurface,
  selectReviewerGuidance,
  summarizeBlastRadius,
  summarizePackageUsage,
} from "../../narrativePresentation.js";
import { scanSurfaceCopy } from "../../scanSurfaceCopy.js";
import type { ScanPresentationBundle } from "../orchestration/scanPresentationBundle.js";

function topAreaLabel(bundle: ScanPresentationBundle): string | null {
  const area = bundle.facts.affectedAreas[0];
  if (!area) return null;
  const formatted = formatCardAreaLabels([area.label], 1);
  return formatted[0] ?? area.label;
}

export function composeHeadline(bundle: ScanPresentationBundle): string {
  const { facts, profile } = bundle;
  const primary = facts.changedPackages.primary;

  if (profile.priority === "limited") {
    return scanSurfaceCopy.presentation.limitedContextHeadline;
  }

  if (!primary) {
    return scanSurfaceCopy.presentation.noChangedPackagesHeadline;
  }

  const runtime = facts.runtimeSurface?.kind === "runtime";
  const area = topAreaLabel(bundle);

  if (facts.changedPackages.all.length > 1 && runtime) {
    return scanSurfaceCopy.presentation.multiRuntimeHeadline;
  }

  if (
    facts.runtimeSurface?.kind === "build" ||
    facts.reachability?.kind === "build_only"
  ) {
    return scanSurfaceCopy.presentation.buildOnlyHeadline.replace(
      "{package}",
      primary,
    );
  }

  if (runtime) {
    const surface = area ?? labelRuntimeSurface(facts) ?? "application code";
    return scanSurfaceCopy.presentation.runtimeHeadline
      .replace("{package}", primary)
      .replace("{surface}", surface);
  }

  return scanSurfaceCopy.presentation.defaultUpgradeHeadline.replace(
    "{package}",
    primary,
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
  const { facts, profile } = bundle;
  const points: string[] = [];

  if (profile.priority === "limited") {
    points.push(scanSurfaceCopy.presentation.limitedContextKeyPoint);
    if (facts.changedPackages.primary) {
      points.push(
        scanSurfaceCopy.presentation.changedPackageKeyPoint.replace(
          "{package}",
          facts.changedPackages.primary,
        ),
      );
    }
    return points.slice(0, max);
  }

  const usage = summarizePackageUsage(facts, { maxPaths: 2 });
  if (usage && usage.pathCount > 0) {
    if (usage.pathCount === 1 && usage.pathSamples[0]) {
      points.push(
        scanSurfaceCopy.presentation.usedInPathsSingle.replace(
          "{path}",
          usage.pathSamples[0],
        ),
      );
    } else {
      points.push(
        scanSurfaceCopy.presentation.usedInPathsMultiple.replace(
          "{count}",
          String(usage.pathCount),
        ),
      );
    }
  } else if (profile.density === "minimal") {
    points.push(scanSurfaceCopy.presentation.noRuntimePathsKeyPoint);
  }

  const blast = summarizeBlastRadius(facts, 2);
  if (blast.levelLabel) {
    if (blast.levelLabel.toLowerCase().includes("wide")) {
      points.push(scanSurfaceCopy.presentation.blastRadiusWideKeyPoint);
    } else if (profile.density === "rich") {
      points.push(
        scanSurfaceCopy.presentation.blastRadiusLevelKeyPoint.replace(
          "{level}",
          blast.levelLabel,
        ),
      );
    }
  }

  if (facts.affectedAreas.length === 0 && profile.density === "minimal") {
    points.push(scanSurfaceCopy.presentation.noAffectedAreasKeyPoint);
  } else if (facts.affectedAreas.length > 0) {
    const labels = facts.affectedAreas
      .slice(0, 2)
      .map((a) => a.label)
      .join(", ");
    points.push(
      scanSurfaceCopy.presentation.affectedAreasKeyPoint.replace(
        "{areas}",
        labels,
      ),
    );
  }

  const guidance = selectReviewerGuidance(facts, { scope: "changed", max: 2 });
  for (const g of guidance) {
    const msg = g.message.trim();
    if (msg && !points.includes(msg)) points.push(msg);
    if (points.length >= max) break;
  }

  return points.slice(0, max);
}

export function composeVerificationActions(
  bundle: ScanPresentationBundle,
  max: number,
): string[] {
  const { facts, profile } = bundle;
  const actions: string[] = [];

  const guidance = selectReviewerGuidance(facts, { scope: "changed", max: 4 });
  for (const g of guidance) {
    const rem = g.remediation?.trim();
    if (rem) actions.push(rem);
  }

  const prompt = composeVerificationPrompt(facts);
  if (prompt && !actions.includes(prompt)) actions.push(prompt);

  if (actions.length === 0) {
    if (
      profile.density === "minimal" ||
      facts.runtimeSurface?.kind === "build"
    ) {
      actions.push(scanSurfaceCopy.presentation.verifyCiTypecheck);
    } else if (profile.density === "rich") {
      actions.push(scanSurfaceCopy.presentation.verifyAuthFlow);
      actions.push(scanSurfaceCopy.presentation.verifyErrorResponses);
    }
  }

  return actions.slice(0, max);
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
  const { facts } = bundle;
  const rows: Array<{ label: string; value: string }> = [];

  const runtime = labelRuntimeSurface(facts);
  if (runtime) rows.push({ label: "Runtime", value: runtime });

  const reach = labelReachabilityKind(facts);
  if (reach) rows.push({ label: "Reachability", value: reach });

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
