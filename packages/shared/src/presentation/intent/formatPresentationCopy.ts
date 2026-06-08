import { scanSurfaceCopy } from "../../scanSurfaceCopy.js";
import type { ScanNarrativeFacts } from "../../scanNarrativeFacts.js";
import type { PresentationStatus } from "../dto/types.js";
import {
  applyPostureVocabularyGuardHeadline,
  applyPostureVocabularyGuardLines,
} from "./applyPostureVocabularyGuard.js";
import { formatPackageDisplayName } from "./packageDisplayName.js";
import type { PresentationInterpretation } from "./presentationIntent.js";

function anchorSemantics(
  facts: ScanNarrativeFacts,
  interpretation: PresentationInterpretation,
) {
  const name = interpretation.anchorPackage;
  if (!name) return null;
  return (
    facts.changedPackageSemantics.find((r) => r.packageName === name) ?? null
  );
}

export function formatPresentationHeadline(
  interpretation: PresentationInterpretation,
  facts: ScanNarrativeFacts,
  status: PresentationStatus | undefined,
): string {
  const anchor = interpretation.anchorPackage ?? facts.changedPackages.primary;
  const row = anchorSemantics(facts, interpretation);
  const pkgDisplay = formatPackageDisplayName(
    anchor ?? "dependency",
    row?.packageRole,
  );
  const copy = scanSurfaceCopy.presentation;
  let headline: string;

  switch (interpretation.intent) {
    case "limited_context":
      headline = copy.limitedContextHeadline;
      break;
    case "no_changed_packages":
      headline = copy.noChangedPackagesHeadline;
      break;
    case "tooling_patch":
      headline = copy.toolingPatchHeadline.replace("{package}", pkgDisplay);
      break;
    case "tooling_upgrade":
      headline = copy.toolingUpgradeHeadline.replace("{package}", pkgDisplay);
      break;
    case "multi_runtime_upgrade":
      headline = copy.multiRuntimeHeadline;
      break;
    case "auth_runtime_upgrade":
    case "queue_runtime_upgrade":
    case "runtime_upgrade": {
      const surface = interpretation.runtimeSurfaceLabel ?? "application code";
      headline = copy.runtimeUpgradeHeadline
        .replace("{package}", pkgDisplay)
        .replace("{surface}", surface);
      break;
    }
    case "unknown_upgrade":
      if (status === "safe") {
        headline = copy.safeNeutralHeadline.replace("{package}", pkgDisplay);
      } else {
        headline = copy.defaultUpgradeHeadline.replace("{package}", pkgDisplay);
      }
      break;
    default:
      headline = copy.safeNeutralHeadline.replace("{package}", pkgDisplay);
  }

  return applyPostureVocabularyGuardHeadline(
    headline,
    status,
    interpretation.anchorPackage,
  );
}

function formatExpectedImpactKeyPoint(
  interpretation: PresentationInterpretation,
): string | null {
  if (
    interpretation.intent !== "tooling_patch" &&
    interpretation.intent !== "tooling_upgrade"
  ) {
    return null;
  }
  const key = interpretation.expectedImpactKey;
  let workflows = "build and typecheck workflows";
  if (key === "test_time") workflows = "test workflows";
  else if (key === "development_only") workflows = "development workflows";
  else if (key === "build_time") workflows = "build workflows";
  return scanSurfaceCopy.presentation.expectedImpactLimitedKeyPoint.replace(
    "{workflows}",
    workflows,
  );
}

function formatLimitedEvidenceKeyPoint(): string {
  return scanSurfaceCopy.presentation.limitedEvidenceKeyPoint;
}

/** Atomic insight lines — no embedded areas or blast radius (those live in separate channels). */
export function formatPresentationInsightLines(
  interpretation: PresentationInterpretation,
  facts: ScanNarrativeFacts,
  status: PresentationStatus | undefined,
): string[] {
  const points: string[] = [];

  if (interpretation.intent === "limited_context") {
    points.push(scanSurfaceCopy.presentation.limitedContextKeyPoint);
    if (facts.changedPackages.primary) {
      points.push(
        scanSurfaceCopy.presentation.changedPackageKeyPoint.replace(
          "{package}",
          facts.changedPackages.primary,
        ),
      );
    }
    return applyPostureVocabularyGuardLines(points, status);
  }

  if (interpretation.showLimitedEvidence) {
    points.push(formatLimitedEvidenceKeyPoint());
  }

  if (interpretation.suppressRuntimeNarrative) {
    points.push(scanSurfaceCopy.presentation.noRuntimePathsKeyPoint);
    const impact = formatExpectedImpactKeyPoint(interpretation);
    if (impact) points.push(impact);
  } else if (interpretation.allowRuntimeNarrative) {
    const usage = facts.packageUsage.find(
      (u) => u.packageName === interpretation.anchorPackage,
    );
    const paths = [...(usage?.paths ?? []), ...(usage?.criticalPaths ?? [])];
    if (paths.length > 0) {
      points.push(
        scanSurfaceCopy.presentation.usedInRuntimePathsKeyPoint.replace(
          "{count}",
          String(paths.length),
        ),
      );
    } else {
      points.push(scanSurfaceCopy.presentation.runtimeUsageKeyPoint);
    }
  }

  return applyPostureVocabularyGuardLines(points, status);
}

/** @deprecated Use buildNarrativeChannels + projectCompactKeyPoints. */
export function formatPresentationKeyPoints(
  interpretation: PresentationInterpretation,
  facts: ScanNarrativeFacts,
  status: PresentationStatus | undefined,
  max: number,
): string[] {
  const points = formatPresentationInsightLines(interpretation, facts, status);

  if (interpretation.allowRuntimeNarrative && facts.affectedAreas.length > 0) {
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

  const blast = facts.blastRadius;
  if (blast?.level === "wide") {
    points.push(scanSurfaceCopy.presentation.blastRadiusWideKeyPoint);
  } else if (blast?.level === "moderate") {
    points.push(
      scanSurfaceCopy.presentation.blastRadiusLevelKeyPoint.replace(
        "{level}",
        "Moderate",
      ),
    );
  }

  return points.slice(0, max);
}

const AUTH_VERIFICATION = [
  "routes",
  "middleware/hooks",
  "auth flow",
  "serialization",
  "error handling",
];

const QUEUE_VERIFICATION = [
  "workers",
  "queue",
  "serialization",
  "error handling",
];

const RUNTIME_DEFAULT_VERIFICATION = [
  "routes",
  "middleware/hooks",
  "error handling",
];

export function formatPresentationVerification(
  interpretation: PresentationInterpretation,
  status: PresentationStatus | undefined,
  max: number,
): string[] {
  let actions: string[] = [];

  if (interpretation.verificationLabels.length > 0) {
    actions = [...interpretation.verificationLabels];
  } else if (interpretation.intent === "auth_runtime_upgrade") {
    actions = [...AUTH_VERIFICATION];
  } else if (interpretation.intent === "queue_runtime_upgrade") {
    actions = [...QUEUE_VERIFICATION];
  } else if (interpretation.allowRuntimeNarrative) {
    actions = [...RUNTIME_DEFAULT_VERIFICATION];
  } else if (
    interpretation.intent === "tooling_patch" ||
    interpretation.intent === "tooling_upgrade"
  ) {
    actions = ["CI", "typecheck", "build"];
  }

  return applyPostureVocabularyGuardLines(actions, status).slice(0, max);
}
