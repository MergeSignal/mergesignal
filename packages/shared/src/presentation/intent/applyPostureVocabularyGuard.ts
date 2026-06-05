import { scanSurfaceCopy } from "../../scanSurfaceCopy.js";
import type { PresentationStatus } from "../dto/types.js";
import { formatPackageDisplayName } from "./packageDisplayName.js";

const SAFE_FORBIDDEN =
  /\b(needs\s+review|critical\s+concern|high\s+risk|significant\s+impact|urgent\s+verification|severe\s+exposure|review\s+before\s+merge|wide\s+blast\s+radius)\b/i;

const NEEDS_REVIEW_FORBIDDEN =
  /\b(no\s+action\s+required|no\s+verification\s+required|safe\s+to\s+merge|no\s+concerns)\b/i;

const RISKY_FORBIDDEN =
  /\b(no\s+action\s+required|minor\s+findings\s+only|low\s+risk|no\s+concerns)\b/i;

function violatesPosture(text: string, status: PresentationStatus): boolean {
  const t = text.trim();
  if (!t) return true;
  switch (status) {
    case "safe":
      return SAFE_FORBIDDEN.test(t);
    case "needs_review":
      return NEEDS_REVIEW_FORBIDDEN.test(t);
    case "risky":
      return RISKY_FORBIDDEN.test(t);
    default:
      return false;
  }
}

export function guardHeadlineForPosture(
  headline: string,
  status: PresentationStatus,
  anchorPackage: string | null,
): string {
  if (!violatesPosture(headline, status)) return headline;
  const pkg = anchorPackage
    ? formatPackageDisplayName(anchorPackage)
    : "Dependency";
  if (status === "safe") {
    return scanSurfaceCopy.presentation.safeNeutralHeadline.replace(
      "{package}",
      pkg,
    );
  }
  return headline;
}

function guardLinesForPosture(
  lines: string[],
  status: PresentationStatus,
): string[] {
  return lines.filter((line) => !violatesPosture(line, status));
}

export function applyPostureVocabularyGuardHeadline(
  headline: string,
  status: PresentationStatus | undefined,
  anchorPackage: string | null,
): string {
  if (!status) return headline;
  return guardHeadlineForPosture(headline, status, anchorPackage);
}

export function applyPostureVocabularyGuardLines(
  lines: string[],
  status: PresentationStatus | undefined,
): string[] {
  if (!status) return lines;
  return guardLinesForPosture(lines, status);
}
