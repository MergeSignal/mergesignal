import type {
  Assessment,
  SufficiencyBlockerKind,
} from "../../assessment/types.js";

const COLLECTION_LIMITATION_ABSTAIN_REASONS = new Set([
  "insufficient_collection",
  "partial_monorepo_scan",
]);

const COLLECTION_LIMITATION_BLOCKER_KINDS = new Set<SufficiencyBlockerKind>([
  "repository_coverage_insufficient",
  "package_facts_missing",
]);

/**
 * Whether sealed Assessment state establishes collection/context limitation for
 * presentation subheadline selection. Answers a presentation question only —
 * does not reinterpret evidence or re-adjudicate sufficiency.
 */
export function assessmentEstablishesCollectionLimitation(
  assessment: Assessment,
): boolean {
  if (
    assessment.abstainReasons?.some((reason) =>
      COLLECTION_LIMITATION_ABSTAIN_REASONS.has(reason.kind),
    )
  ) {
    return true;
  }
  const blockers = assessment.evidenceSufficiencyVerdict?.blockers ?? [];
  return blockers.some((blocker) =>
    COLLECTION_LIMITATION_BLOCKER_KINDS.has(blocker.kind),
  );
}
