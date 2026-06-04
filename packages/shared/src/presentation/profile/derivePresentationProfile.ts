import type { ScanNarrativeFacts } from "../../scanNarrativeFacts.js";
import { mergePostureFromDecision } from "../../riskVocabulary.js";
import { scanSurfaceCopy } from "../../scanSurfaceCopy.js";
import type { PipelineStatus, PresentationStatus } from "../dto/types.js";
import type { PresentationProfile } from "./presentationProfile.js";

export type DerivePresentationProfileContext = {
  pipelineStatus: PipelineStatus;
  decision?: string | null;
  totalScore?: number | null;
};

function statusFromScore(
  totalScore: number | null | undefined,
): PresentationStatus {
  if (totalScore == null || !Number.isFinite(totalScore)) return "needs_review";
  if (totalScore <= 30) return "safe";
  if (totalScore <= 60) return "needs_review";
  return "risky";
}

function resolveStatus(
  facts: ScanNarrativeFacts,
  ctx: DerivePresentationProfileContext,
): PresentationStatus {
  const fromFacts = facts.mergePosture;
  if (fromFacts) return fromFacts;
  const fromDecision = mergePostureFromDecision(ctx.decision ?? undefined);
  if (fromDecision) return fromDecision;
  return statusFromScore(ctx.totalScore ?? facts.riskIndex);
}

function hasStrongPrIntelligence(facts: ScanNarrativeFacts): boolean {
  return (
    facts.availability.tiersPresent.tier1 &&
    facts.availability.repoIntelligenceParse === "ok"
  );
}

function hasHighSeverityFindings(facts: ScanNarrativeFacts): boolean {
  return facts.reviewerGuidance.some(
    (g) =>
      g.kind === "finding" &&
      (g.priority === "critical" || g.priority === "high"),
  );
}

function hasRuntimeUsage(facts: ScanNarrativeFacts): boolean {
  if (facts.runtimeSurface?.kind === "runtime") return true;
  return facts.packageUsage.some(
    (u) => u.paths.length > 0 || u.criticalPaths.length > 0,
  );
}

function deriveDensity(
  facts: ScanNarrativeFacts,
  priority: PresentationProfile["priority"],
): PresentationProfile["density"] {
  if (priority === "limited") {
    return hasHighSeverityFindings(facts) ? "standard" : "minimal";
  }

  const runtime = facts.runtimeSurface?.kind === "runtime";
  const wideOrModerate =
    facts.blastRadius?.level === "wide" ||
    facts.blastRadius?.level === "moderate";
  const hasAreas = facts.affectedAreas.length > 0;
  const hasRuntimePaths = hasRuntimeUsage(facts);

  if (runtime && (wideOrModerate || hasAreas || hasRuntimePaths)) {
    return "rich";
  }

  const buildOnly =
    facts.runtimeSurface?.kind === "build" ||
    facts.reachability?.kind === "build_only";
  const narrowBlast =
    !facts.blastRadius || facts.blastRadius.level === "narrow";

  if (buildOnly && narrowBlast && !hasAreas) {
    return "minimal";
  }

  return "standard";
}

function deriveConfidence(
  facts: ScanNarrativeFacts,
  priority: PresentationProfile["priority"],
): PresentationProfile["confidence"] {
  if (priority === "limited") return "low";

  const decisionConf = facts.confidence.decision;
  if (decisionConf === "high" || decisionConf === "medium") return "high";

  const sparseUsage =
    facts.packageUsage.length === 0 ||
    facts.packageUsage.every(
      (u) => u.paths.length === 0 && u.criticalPaths.length === 0,
    );

  if (sparseUsage) return "medium";
  return "high";
}

/** INTERNAL - only called from buildScanPresentationBundle */
export function derivePresentationProfile(
  facts: ScanNarrativeFacts,
  ctx: DerivePresentationProfileContext,
): PresentationProfile | null {
  if (ctx.pipelineStatus !== "done") return null;

  const priority = hasStrongPrIntelligence(facts)
    ? "pr_intelligence"
    : "limited";
  const status = resolveStatus(facts, ctx);
  const density = deriveDensity(facts, priority);
  const confidence = deriveConfidence(facts, priority);

  const degradedMessage =
    priority === "limited"
      ? scanSurfaceCopy.presentation.limitedContextMessage
      : undefined;

  return {
    status,
    density,
    confidence,
    priority,
    degradedMessage,
  };
}
